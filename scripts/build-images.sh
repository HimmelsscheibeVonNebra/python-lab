#!/usr/bin/env bash
# Build the guest images (no gcc, nothing is compiled):
#
#   images/rootfs.cpio.gz   initramfs: BusyBox + Python 3 + the course code
#   images/9p/              pandas, matplotlib, numpy, flask ... over 9p;
#                           the guest downloads a file only when it opens it
#
#   scripts/build-images.sh
#
# Alpine Linux's prebuilt x86 (i686, musl) packages are installed into empty
# roots with apk inside an Alpine container, so this works on any Docker host
# (x86_64 or arm64, Linux or macOS): apk only unpacks the x86 packages, it
# never runs them.  The kernel (images/bzImage) is not rebuilt: it is the
# Linux Kernel Lab's 6.12 i686 kernel (initramfs, devtmpfs, tmpfs, 9p).
#
# Environment:
#   ALPINE_VERSION   Alpine branch to take packages from (default: 3.24)
#   PACKAGES         extra packages for the initramfs
#   PACKAGES_9P      packages served lazily over 9p
#                    (default: "py3-pandas py3-matplotlib py3-flask")
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALPINE_VERSION="${ALPINE_VERSION:-3.24}"
PACKAGES="${PACKAGES:-}"
PACKAGES_9P="${PACKAGES_9P-py3-pandas py3-matplotlib py3-flask}"

docker run --rm \
	-v "$REPO_DIR":/src \
	-e ALPINE_VERSION="$ALPINE_VERSION" -e PACKAGES="$PACKAGES" -e PACKAGES_9P="$PACKAGES_9P" \
	"alpine:$ALPINE_VERSION" sh -euc '
		# Tools for this (native) container: 9p conversion needs zstd in Python.
		apk add -q --no-cache python3 py3-zstandard

		R=/tmp/rootfs        # initramfs
		X=/tmp/rootfs-9p     # initramfs + the 9p packages, to diff against R
		mkdir -p "$R/etc/apk/keys"
		for repo in main community; do
			echo "https://dl-cdn.alpinelinux.org/alpine/v$ALPINE_VERSION/$repo"
		done > "$R/etc/apk/repositories"
		cp /usr/share/apk/keys/x86/* "$R/etc/apk/keys/"

		# --no-scripts: the x86 install scripts cannot run here; the only one
		# that matters (BusyBox applet links) is done at boot by /init.
		x86apk() { r=$1; shift; apk --root "$r" --arch x86 --no-scripts --no-cache "$@"; }
		x86apk "$R" add --initdb musl busybox python3 nano ncurses-terminfo-base $PACKAGES

		# For the pages (scripts/gen-pages.mjs): "3.14.10"
		apk --root "$R" list --installed python3 2>/dev/null \
			| sed -n "s/^python3-\([0-9][0-9.]*\)-r.*/\1/p" > /src/images/python-version

		# ---- 9p tree: every file the extra packages add, under /py
		rm -rf /src/images/9p /tmp/9p-tree
		mkdir -p /tmp/9p-tree/host /tmp/9p-tree/py /src/images/9p/base
		if [ -n "$PACKAGES_9P" ]; then
			cp -a "$R" "$X"
			x86apk "$X" add $PACKAGES_9P
			# Alpine builds OpenBLAS with a Core2 baseline: even its generic
			# code uses SSSE3 (palignr), which v86 does not emulate, so numpy
			# dies with SIGILL in linalg (and matplotlib with it).  Serve the
			# reference BLAS/LAPACK (plain x86 baseline) instead, behind a
			# code-free libopenblas.so.3 whose only content is DT_NEEDED
			# entries for them.  No code is compiled; lld only writes headers.
			if [ -e "$X/usr/lib/libopenblas.so.3" ]; then
				apk add -q --no-cache llvm lld
				x86apk "$X" add blas cblas lapack
				llvm-mc -triple=i386-linux-musl -filetype=obj -o /tmp/empty.o /dev/null
				rm -f "$X"/usr/lib/libopenblas*
				ld.lld -m elf_i386 -shared -soname libopenblas.so.3 --no-as-needed \
					-o "$X/usr/lib/libopenblas.so.3" /tmp/empty.o \
					"$X/usr/lib/libcblas.so.3" "$X/usr/lib/liblapack.so.3" "$X/usr/lib/libblas.so.3"
			fi
			(cd "$R" && find . ! -type d | sort) > /tmp/base.list
			(cd "$X" && find . ! -type d | sort) > /tmp/all.list
			comm -13 /tmp/base.list /tmp/all.list | grep -Ev "^\./(lib/apk|etc/apk|usr/bin|usr/include)/" \
				> /tmp/extra.list
			(cd "$X" && tar -cf - -T /tmp/extra.list) | tar -xf - -C /tmp/9p-tree/py
			find /tmp/9p-tree/py -name "*.opt-[12].pyc" -delete
			find /tmp/9p-tree/py -path "*/tests/*" -delete
			find /tmp/9p-tree/py -depth -type d -empty -delete
		fi
		python3 /src/scripts/v86/fs2json.py --zstd --out /src/images/9p/fs.json /tmp/9p-tree
		python3 /src/scripts/v86/copy-to-sha256.py --zstd /tmp/9p-tree /src/images/9p/base > /dev/null

		# ---- initramfs
		# Drop what a terminal-only lab cannot use: GUI, bundled pip wheels,
		# CPython self-test modules, the C-extension build kit.
		PY=$(echo "$R"/usr/lib/python3.*)
		rm -rf "$PY"/tkinter "$PY"/turtledemo "$PY"/turtle.py "$PY"/idlelib \
			"$PY"/ensurepip "$PY"/config-3.* \
			"$PY"/lib-dynload/_test* "$PY"/lib-dynload/xx* \
			"$PY"/lib-dynload/_ctypes_test* \
			"$R"/usr/include "$R"/usr/share/man "$R"/usr/share/doc \
			"$R"/lib/apk "$R"/etc/apk "$R"/var/cache/apk
		find "$PY" -name "*.opt-[12].pyc" -delete
		find "$PY" -path "*/__pycache__/turtle.*" -delete
		# Python finds the 9p packages through a .pth file (see lab.sh for
		# their shared libraries).
		echo "/opt/py/usr/lib/$(basename "$PY")/site-packages" > "$PY/site-packages/lab-9p.pth"

		cp -R /src/rootfs/overlay/. "$R"/
		# Course code: course/weekNN -> ~/weekNN, course/sample -> ~/sample
		cp -R /src/course/. "$R/home/student/"
		chmod 755 "$R/init" "$R/sbin/lab-shell" "$R/usr/bin/flask"
		mkdir -p "$R"/proc "$R"/sys "$R"/dev "$R"/tmp "$R"/run "$R"/mnt/9p "$R"/root "$R"/opt
		ln -sfn 9p/host "$R/mnt/host"
		ln -sfn /mnt/9p/py "$R/opt/py"
		chmod 1777 "$R/tmp"
		# The kernel opens /dev/console for /init before devtmpfs is mounted.
		mknod -m 600 "$R/dev/console" c 5 1
		find "$R" -name .DS_Store -delete
		ln -sfn python3 "$R/usr/bin/python"
		chown -R 1000:1000 "$R/home/student"

		cd "$R"
		find . | sort | cpio -o -H newc --quiet | gzip -9 > /src/images/rootfs.cpio.gz
		echo "initramfs: $(du -sh . | cut -f1) unpacked   9p: $(du -sh /tmp/9p-tree/py | cut -f1) ($(du -sh /src/images/9p | cut -f1) zstd)"
	'
ls -l "$REPO_DIR/images/"
