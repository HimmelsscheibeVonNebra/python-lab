export TERM=xterm-256color
export LANG=C.UTF-8
# Korea Standard Time without tzdata (POSIX TZ string)
export TZ=KST-9
export EDITOR=nano
# Shared libraries of the 9p packages (numpy, matplotlib ...)
export LD_LIBRARY_PATH=/opt/py/usr/lib
export MPLBACKEND=Agg
# The serial terminal on the web page is 100x30 (js/lab.js).
case "$(tty)" in /dev/ttyS*) stty rows 30 cols 100 ;; esac

alias ll='ls -l'
if [ "$(id -u)" = 0 ]; then
	PS1='python-lab:\w# '
else
	PS1='student@python-lab:\w\$ '
fi
export PS1
cd "$HOME"
# lab.dir=<dir> on the kernel command line: the page's start directory
dir=$(sed -n 's/.*lab\.dir=\([^ ]*\).*/\1/p' /proc/cmdline)
[ -n "$dir" ] && [ -d "$HOME/$dir" ] && cd "$HOME/$dir"
# Flask pages: fetch the Flask zip (9p) in the background while the reader
# looks around, so the first "web start" does not wait for the network.
case "$dir" in web*) [ -e /opt/py/flask.zip ] && (cat /opt/py/flask.zip > /dev/null 2>&1 &) ;; esac
unset dir
printf '\n  Python Lab -- %s   %s\n\n' "$(python3 -V)" "$(pwd)"
