import shutil
import os
import platform
import requests
import json
import tempfile
import stat
import urllib.request
import zipfile

def get_driver_version():
    version = os.getenv("WEBDRIVER_VERSION")
    assert version is not None
    assert version != ""
    return version

def get_os():
    # Blatantly ignoring arm for now, I doubt architecture matters for
    # typescript shit anyway
    if platform.system() == "Linux":
        return "linux64"
    else:
        return "win64"

def get_zip_path():
    if platform.system() == "Linux":
        return "chromedriver-linux64/chromedriver"
    else:
        return "chromedriver-win64/chromedriver.exe"

def get_driver_url(version):
    r = requests.get("https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json")
    assert r.status_code == 200, r.text

    data = json.loads(r.text)
    versions: list = data["versions"]

    for i in list(versions):
        if i["version"].startswith(version):
            print("Matched", i["version"], "from", version)
            downloads = i["downloads"]["chromedriver"]
            for download in downloads:
                if download["platform"] == get_os():
                    return download["url"]

            raise RuntimeError("Failed to resolve driver URL")

def ensure_webdriver(version = get_driver_version()):
    path = os.path.join(
        tempfile.gettempdir(),
        f"driver-{version}"
    )

    if os.path.exists(path):
        return path

    urllib.request.urlretrieve(
        get_driver_url(version),
        path + ".zip"
    )


    with zipfile.ZipFile(path + ".zip", 'r') as zip_ref:
        zip_ref.extract(get_zip_path(), path + "-intermediate")
    shutil.copyfile(
        path + "-intermediate/" + get_zip_path(),
        path
    )
    if platform.system() == "Linux":
        st = os.stat(path)
        os.chmod(path, st.st_mode | stat.S_IEXEC)

    return path
