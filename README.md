# Python Lab — 파이썬 기초 프로그래밍

웹브라우저에서 32비트 x86 Linux를 부팅해 [2026_BasicProgrammingUsingPython](../2026_BasicProgrammingUsingPython) 강의의 수업 내용과 예제(`Codes/`, `Sample/`의 Flask 예제)를 실행하는 교육용 실습 환경입니다. 모든 페이지는 영어/한국어를 고를 수 있으며 기본은 영어입니다.
[Linux Lab](../LinuxSystemProgramming_Lab/linux-kernel-lab/)과 같은 구조(v86 에뮬레이터 + xterm.js + 정적 파일)이며, 정적 파일만으로 동작하므로 GitHub Pages에 그대로 배포됩니다. C 컴파일러(gcc)와 커널 모듈 실습은 넣지 않았습니다.

- **수업별 페이지** — `classes/<주차-차시>/index.html`에 그 차시 슬라이드를 풀어 쓴 강의 내용과 예제 목록이 있습니다.
- **예제 페이지** — 예제마다 페이지가 하나씩 있습니다. 페이지를 열면 그 예제의 디렉터리(예: `/home/student/week03/starter/session1`)에서 `student` 사용자 셸이 뜨고, ▶ 버튼을 누르면 실행 순서의 명령이 터미널에 입력됩니다. 수업 코드 전체가 `/home/student/week01` … 에 들어 있습니다.
- **Flask 예제** — `classes/sample/`. 강의 저장소 `Sample/`의 sample1·sample2·sample4 (네이버 API를 쓰는 sample3은 제외).
- **자유 실습** — `playground.html`. REPL, `nano`로 스크립트 작성, 파일 올리기/받기.

## 구성

```text
index.html, playground.html, classes/   생성된 페이지 (scripts/gen-pages.mjs 출력)
css/, js/lab.js, js/lang.js             스타일과 공용 스크립트 (v86 + xterm.js, 파일 올리기/받기, 언어 선택)
build/, bios/, vendor/xterm/            v86, SeaBIOS/VGA BIOS, xterm.js   (Linux Lab에서 복사)
images/bzImage                          Linux 6.12 i686 커널              (Linux Lab에서 복사)
images/rootfs.cpio.gz, images/9p/       게스트 이미지 (scripts/build-images.sh 출력)

course/                                 강의 저장소 사본 → 게스트의 /home/student
                                        (Codes/weekNN → weekNN, Sample/sampleN → sample/sampleN)
examples-meta/                          예제별 설명과 실행 순서 (차시당 JSON 하나, 한국어)
examples-meta/en/                       같은 내용의 영어 문장 (명령은 한국어 파일 것을 씀)
class-notes/, class-notes/en/           차시별 강의 내용 (슬라이드를 풀어 쓴 HTML 조각, 한국어/영어)
rootfs/overlay/                         게스트에 덮어쓰는 파일: /init, inittab, 계정, 프로필, 자유 실습 예제
scripts/                                이미지 빌드, 페이지 생성, 강의 코드 동기화
tests/                                  Node.js 헤드리스 테스트
```

## 로컬 실행

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

`file://`로 직접 열면 WASM과 이미지를 불러오지 못하므로 반드시 HTTP 서버로 엽니다.

## 게스트 환경

| 항목 | 값 |
|---|---|
| 커널 | Linux 6.12.40-kernellab (i686, 단일 CPU), 메모리 256 MB |
| 사용자 공간 | Alpine Linux 3.24 x86 패키지: musl, BusyBox, Python 3.14, nano |
| Python | 표준 라이브러리 전체 (`sqlite3`, `unittest`, `readline`, `curses` 포함), 새 REPL |
| 추가 패키지 | pandas, numpy, matplotlib, Flask (9p, 처음 import할 때 내려받음) |
| 네트워크 | loopback(`127.0.0.1`)만. Flask 서버에는 게스트 안의 `wget`으로 접속 |
| 셸 | 사용자 `student` (uid 1000), `TZ=KST-9`, UTF-8, `MPLBACKEND=Agg` |
| 파일 교환 | 올리기 → `/mnt/host`, `/mnt/host`에 복사한 파일 → 받기 |

부팅은 약 4초, `python3` 시작은 약 1초입니다. 처음 열 때 약 23 MB(커널 3.9 MB, rootfs 17 MB, v86 2.3 MB)를 받습니다.

### pandas · matplotlib · Flask (9p)

pandas·numpy·matplotlib·Flask와 그 의존 라이브러리는 기본 이미지에 넣지 않고 9p 파일시스템(`images/9p/`, 게스트의 `/opt/py`)으로 제공합니다. 페이지는 부팅할 때 파일 목록(`fs.json`)만 받고, 각 파일은 게스트가 처음 열 때 HTTP로 내려받습니다 (전체 50 MB, zstd). Python은 `site-packages/lab-9p.pth`로 이 경로를 찾고, 공유 라이브러리는 `LD_LIBRARY_PATH=/opt/py/usr/lib`로 찾습니다.

- 에뮬레이터 안에서는 `import pandas`가 약 12–15초, matplotlib로 그림 하나를 저장하는 데 약 20초(첫 실행은 글꼴 캐시 생성으로 30초) 걸립니다.
- 그림은 화면에 띄울 수 없으므로 `savefig`로 파일에 저장한 뒤 `/mnt/host`로 복사해 받습니다. 기본 글꼴(DejaVu)에는 한글이 없어 한글 제목은 네모로 나옵니다.
- **OpenBLAS 대신 참조 BLAS/LAPACK**: Alpine의 OpenBLAS는 Core2 기준으로 빌드되어 공통 코드에도 SSSE3 명령(`palignr`)이 있는데, v86은 SSSE3를 지원하지 않아 `numpy.linalg`(그리고 matplotlib의 좌표 변환)가 SIGILL로 죽습니다. 빌드 스크립트는 OpenBLAS를 지우고, 참조 구현(`blas`, `cblas`, `lapack` 패키지)을 `DT_NEEDED`로만 가리키는 코드 없는 `libopenblas.so.3`를 `ld.lld`로 만들어 넣습니다. 선형대수는 느려지지만 수업 규모에서는 문제가 없습니다.

### Flask

Flask 서버는 게스트의 `127.0.0.1`에서만 접속할 수 있습니다 (게스트 커널에 네트워크 카드 드라이버가 없고, 페이지와 게스트 사이에 네트워크가 없음). 그래서 실습용 도우미 명령 `web`(`rootfs/overlay/usr/local/bin/web`, 표준 라이브러리만 쓰는 Python 스크립트)과 페이지의 **앱 미리보기** 창을 둡니다.

**앱 미리보기 (9p 다리)** — `web start`는 앱과 함께 작은 다리 프로세스를 띄웁니다. 다리와 페이지(`js/lab.js`)는 9p 공유 폴더 `/mnt/host/.web`(페이지 쪽 경로 `/host/.web`)의 JSON 파일로 대화합니다.

| 파일 | 쓰는 쪽 | 내용 |
|---|---|---|
| `server.json` | 게스트 | 앱이 실행 중일 때만 존재: `{port, app, started}` → 페이지가 미리보기 창을 연다 |
| `req-<id>.json` | 페이지 | 요청 `{method, path, body, type}` (창 안의 링크·폼, 주소 칸) |
| `res-<id>.json` | 게스트 | 응답 `{status, path, type, body}`. HTML에는 앱의 CSS와 그림을 넣어 줌 |
| `show.json` | 게스트 | `web show PATH` → 페이지가 그 주소를 연다 |

페이지는 응답 HTML을 스크립트를 막은 iframe(`sandbox="allow-same-origin allow-forms"`)에 그리고, 링크 클릭과 폼 제출을 가로채 다시 요청 파일로 보냅니다. 요청 하나에 0.2–1초 걸립니다. 게스트는 부팅할 때 `.web`을 지웁니다.

```sh
web start [app.py]     # 서버를 백그라운드로 띄우고 준비될 때까지 기다림 → 미리보기 창이 열림
web show '/?market=KOSPI'  # 미리보기 창에 띄우기
web get '/?market=KOSPI'   # 상태 코드와 화면을 글자로 (표는 한 행씩)
web html /             # HTML 원문
web save page.html     # CSS를 넣은 HTML 한 파일로 /mnt/host에 저장 → 받기
web log                # 서버 로그
web stop
```

Flask 예제 차시는 가장 작은 앱 `flask_hello`(`rootfs/overlay/home/student/flask_hello/app.py`, 강의 저장소가 아니라 이 실습의 파일)로 시작합니다. 생성기는 예제 파일을 `course/`에서 찾고, 없으면 `rootfs/overlay/home/student/`에서 찾습니다. 패키지의 실행 파일은 9p에 넣지 않으므로 `flask` 명령은 `rootfs/overlay/usr/bin/flask`(`python3 -m flask`)로 제공합니다.

## 언어 (영어/한국어)

모든 페이지는 두 언어를 함께 담고(`<span lang="en">`, `<span lang="ko">`), `js/lang.js`가 `<html data-lang>`으로 하나만 보입니다. 기본은 영어이고, 오른쪽 위의 English/한국어 버튼으로 바꾼 선택은 그 브라우저에 저장됩니다. 터미널 상태 표시(`js/lab.js`)도 같은 선택을 따릅니다.

- 한국어 `examples-meta/<차시>.json`이 명령·테스트의 기준이고, `examples-meta/en/<차시>.json`에는 영어 문장(제목·요약·각 단계 설명)만 있습니다. 단계 수가 다르면 생성기가 멈춥니다.
- 강의 내용은 `class-notes/<차시>.html`과 `class-notes/en/<차시>.html`.
- 영어 파일이 없는 차시도 생성은 되며(한국어가 두 언어 모두에 표시됨), 생성기가 마지막에 `no English yet:`으로 알려 줍니다. 실행 순서를 고치면 두 파일을 함께 고칩니다.

## 수업 내용·예제 수정

1. 강의 저장소의 코드를 다시 가져오고 이미지를 다시 만듭니다 (`course/`가 이미지에 들어갑니다).

   ```bash
   scripts/sync-course.sh        # ../2026_BasicProgrammingUsingPython의 Codes/, Sample/ → course/
   scripts/build-images.sh
   ```

2. `examples-meta/<주차-차시>.json`에 예제의 설명과 실행 순서를, `examples-meta/en/<주차-차시>.json`에 영어 설명을 적습니다. 필드 설명은 `scripts/gen-pages.mjs` 맨 위에 있습니다.

   ```json
   {
     "name": "even_sum",
     "source": "week03/starter/session1/even_sum.py",
     "also": ["week03/solutions/session1/even_sum.py"],
     "summary": "예제가 보여 주는 것",
     "steps": [{ "cmd": "python3 even_sum.py", "note": "관찰할 것" }],
     "expect": "출력에 반드시 나와야 하는 문자열 (테스트용, 선택)"
   }
   ```

   `input()`을 쓰는 프로그램은 `printf '70\n1.75\n' | python3 bmi.py`처럼 입력을 넣어 자동 테스트가 가능하게 합니다. 편집기를 열거나 직접 입력해야 하는 예제는 `"manual": true`, 오류(Traceback)가 학습 내용인 예제는 `"traceback": true`, pandas·matplotlib를 쓰는 예제는 `"slow": true`로 표시합니다.

3. `class-notes/<주차-차시>.html`과 `class-notes/en/<주차-차시>.html`을 고칩니다. 생성기가 허용 태그(`h2 h3 p ul ol li pre code table … a kbd`)와 예제 링크를 검사합니다.

4. 페이지를 다시 만들고 테스트합니다.

   ```bash
   node scripts/gen-pages.mjs
   node tests/examples-test.mjs              # 모든 차시
   node tests/examples-test.mjs week03-1     # 한 차시만
   ```

## 이미지 빌드

Docker만 있으면 됩니다 (macOS·Linux, x86_64·arm64 모두 가능). 게스트에서 실행될 코드는 아무것도 컴파일하지 않습니다.

```bash
scripts/build-images.sh
```

Alpine 컨테이너 안에서 `apk --arch x86`으로 빈 루트에 x86 패키지를 풉니다 (설치 스크립트는 실행하지 않으므로 BusyBox 명령 링크는 부팅할 때 `/init`이 만듭니다).

- **initramfs**: Python과 표준 라이브러리에서 GUI·pip 휠·CPython 자체 테스트 모듈 등을 지우고, `rootfs/overlay/`와 `course/`를 덮어써서 cpio로 묶습니다.
- **9p**: 같은 루트에 `PACKAGES_9P`(기본 `py3-pandas py3-matplotlib`)를 더 설치해, 추가된 파일만 `images/9p/`로 변환합니다 (v86의 `fs2json.py`, `copy-to-sha256.py`; `scripts/v86/`. Python 3.14에서 `compression.zstd`가 없으면 `zstandard`를 쓰도록 고쳤습니다).
- 다른 Alpine 버전: `ALPINE_VERSION=3.23`, initramfs에 패키지 추가: `PACKAGES="..."`, 9p 패키지 바꾸기: `PACKAGES_9P="py3-pandas py3-matplotlib py3-flask"`(기본값), 9p 없이: `PACKAGES_9P=""`.

커널은 다시 빌드하지 않고 Linux Lab의 `images/bzImage`를 그대로 씁니다 (설정: Linux Lab의 `buildroot-external/board/kernellab/linux.config`).

## 테스트

```bash
node tests/python-test.mjs        # 환경: 셸, gcc 없음, 한글 입출력, 표준 라이브러리, pandas·matplotlib·Flask, REPL, 올리기/받기
node tests/examples-test.mjs      # 모든 예제의 실행 순서
```

브라우저 없이 v86으로 이미지를 부팅해, 페이지와 같은 직렬 콘솔 셸에 명령을 입력합니다. `VERBOSE=1`을 주면 게스트 콘솔이 보이고, 예제 테스트의 전체 기록은 `tests/out/<차시>.log`에 남습니다.

## GitHub Pages 배포

저장소 **Settings → Pages → Deploy from a branch → `main` / `(root)`**. 모든 경로가 상대 경로이므로 저장소 이름과 무관하게 동작합니다. `.nojekyll`이 있어 파일이 그대로 제공됩니다. `images/9p/base/`에 작은 파일이 약 3,800개 있습니다 (전체 50 MB).

## 제약

- v86은 32비트 단일 코어 에뮬레이터입니다. 계산이 많은 코드는 실제 PC보다 수십 배 느립니다.
- 네트워크가 없어 `pip install`, 웹 API 호출(예: `Sample/sample3`의 네이버 API), 내 브라우저에서 Flask 서버 접속은 할 수 없습니다. git·GitHub·GitHub Pages·VS Code·Colab 실습은 실제 PC에서 진행합니다.
- 게스트 상태는 브라우저 메모리에만 있으며 새로고침하면 초기화됩니다. 작성한 파일은 `/mnt/host`로 복사해 **받기**로 저장합니다.
- GitHub Pages는 정적 호스팅이라 서버 측 제출·채점 기능은 없습니다.

## 라이선스 및 소스 제공

`images/`에는 Alpine Linux의 바이너리 패키지가 들어 있습니다: BusyBox(GPL-2.0), musl(MIT), Python(PSF-2.0), nano·readline(GPL-3.0), ncurses(MIT), SQLite(public domain), OpenSSL(Apache-2.0), libstdc++·libgcc·libgfortran(GPL-3.0 + runtime exception), 그리고 `images/9p/`에 pandas·numpy·matplotlib·Pillow·Flask·Jinja2·Werkzeug 등(BSD 계열·PSF·HPND)과 참조 BLAS/LAPACK(BSD-3-Clause), FreeType(FTL/GPL-2.0) 등. 대응 소스는 [Alpine aports](https://gitlab.alpinelinux.org/alpine/aports)의 3.24 브랜치와 Alpine 미러의 소스 패키지로 제공됩니다. `images/bzImage`는 Linux 커널(GPL-2.0)로, Linux Lab의 Buildroot 설정으로 같은 소스를 재현할 수 있습니다. v86은 BSD-2-Clause(`build/LICENSE.v86`), xterm.js는 MIT(`vendor/xterm/LICENSE`), SeaBIOS는 LGPL-3.0입니다. `course/`는 강의 저장소의 코드입니다.
