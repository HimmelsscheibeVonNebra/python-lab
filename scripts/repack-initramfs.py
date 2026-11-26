#!/usr/bin/env python3
"""Updates images/rootfs.cpio.gz without Docker: replaces the student's home
and the rootfs/overlay files in an existing initramfs, keeping everything
else (BusyBox, Python, the packages) as the last scripts/build-images.sh run
made it.

    scripts/repack-initramfs.py [base.cpio.gz]     (default: images/rootfs.cpio.gz)

Use it after changing course/, rootfs/overlay/ or the examples when a full
Docker build is not possible.  It drops every /home/student/** entry and every
file that rootfs/overlay provides, then adds rootfs/overlay (owned by root;
init, lab-shell, flask, web, lab-srcwatch executable) and course/ plus
rootfs/overlay/home/student (owned by student, uid 1000) -- the same final
steps as build-images.sh.  Changes to packages, the Python stdlib or the 9p
tree still need build-images.sh.
"""
import gzip, os, stat, sys
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "images/rootfs.cpio.gz")

def entries(data):
    i = 0
    while True:
        assert data[i:i+6] == b"070701", i
        f = [int(data[i+6+8*k:i+14+8*k], 16) for k in range(13)]
        namesize, filesize = f[11], f[6]
        name_start = i + 110
        name = data[name_start:name_start+namesize-1].decode()
        end_name = (name_start + namesize + 3) & ~3
        end = (end_name + filesize + 3) & ~3
        if name == "TRAILER!!!":
            return
        yield name, f, data[i:end]
        i = end

def header(ino, mode, uid, gid, nlink, mtime, size, name):
    nb = name.encode() + b"\0"
    h = b"070701" + b"".join(b"%08X" % v for v in (ino, mode, uid, gid, nlink, mtime, size, 0, 0, 0, 0, len(nb), 0))
    pad = (-(len(h) + len(nb))) % 4
    return h + nb + b"\0" * pad

def entry(ino, mode, uid, gid, mtime, name, data=b""):
    out = header(ino, mode, uid, gid, 1, mtime, len(data), name) + data
    return out + b"\0" * ((-len(out)) % 4)

base = gzip.decompress(open(BASE, "rb").read())
overlay = os.path.join(REPO, "rootfs/overlay")
replace = set()
for d, dirs, files in os.walk(overlay):
    for n in files:
        replace.add(os.path.relpath(os.path.join(d, n), overlay))
out = []
max_ino = max_kept = 0
kept_names = set()      # the kernel does not create parent directories: keep the base's
kept = dropped = 0
for name, f, raw in entries(base):
    max_ino = max(max_ino, f[0])
    if name.startswith("./"): name2 = name[2:]
    else: name2 = name
    if name2.startswith("home/student/") or name2 in replace:
        dropped += 1
        continue
    out.append(raw); kept += 1
    kept_names.add(name2)
    max_kept = max(max_kept, f[0])
ino = max_kept + 1
mtime = 1795600000
# chmod 755 in scripts/build-images.sh
EXEC = {"init", "sbin/lab-shell", "usr/bin/flask", "usr/local/bin/web", "usr/local/bin/lab-srcwatch"}
added = 0
def add_tree(src, dst_prefix, uid, gid, skip=None):
    global ino, added
    for d, dirs, files in os.walk(src):
        dirs.sort(); files.sort()
        rel = os.path.relpath(d, src)
        if skip and skip(rel): dirs[:] = []; continue
        dname = dst_prefix if rel == "." else (rel if dst_prefix == "" else f"{dst_prefix}/{rel}")
        if rel != "." or dst_prefix == "home/student/x":
            pass
        if rel != "." and dname not in kept_names:
            kept_names.add(dname)
            out.append(entry(ino, stat.S_IFDIR | 0o755, uid, gid, mtime, dname)); ino += 1; added += 1
        for n in files:
            if n == ".DS_Store": continue
            p = os.path.join(d, n)
            st = os.lstat(p)
            if stat.S_ISLNK(st.st_mode):
                out.append(entry(ino, stat.S_IFLNK | 0o777, uid, gid, mtime, n if dname == "" else f"{dname}/{n}", os.readlink(p).encode()))
            else:
                name = n if dname == "" else f"{dname}/{n}"
                perm = 0o755 if (st.st_mode & 0o111 or name in EXEC) else 0o644
                out.append(entry(ino, stat.S_IFREG | perm, uid, gid, mtime, name, open(p, "rb").read()))
            ino += 1; added += 1
# overlay without home/student (root), then home/student from course + overlay (student)
add_tree(overlay, "", 0, 0, skip=lambda rel: rel == "home" or rel.startswith("home/"))
add_tree(os.path.join(REPO, "course"), "home/student", 1000, 1000)
add_tree(os.path.join(overlay, "home/student"), "home/student", 1000, 1000)
out.append(header(0, 0, 0, 0, 1, 0, 0, "TRAILER!!!"))
blob = b"".join(out)
blob += b"\0" * ((-len(blob)) % 512)
tmp = os.path.join(REPO, "images/rootfs.cpio.gz.tmp")
with gzip.GzipFile(tmp, "wb", compresslevel=9, mtime=0) as g:
    g.write(blob)
os.replace(tmp, os.path.join(REPO, "images/rootfs.cpio.gz"))
print(f"kept {kept}, dropped {dropped}, added {added} entries -> images/rootfs.cpio.gz ({os.path.getsize(os.path.join(REPO,'images/rootfs.cpio.gz'))} bytes)")
