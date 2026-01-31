import tests.utils
from functools import partial
import os
import shutil
import subprocess
from time import sleep
import platform
import random
from tests.helpers import driver as DriverUtil

import pytest
from selenium.common.exceptions import NoSuchWindowException
from selenium.webdriver import Chrome, ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait

from tests.constants import SCREENSHOT_DIR
from tests.copyparty import Copyparty
from tests.utils import close_notices, delay_for_windows_bullshit, execute

@pytest.fixture
def vault():
    # The paths need to be replaced, because during string substitution, the \
    # are interpreted literally
    test_vault = os.path.join(os.getcwd(), "test_vault") \
        .replace("\\", "/")

    if os.path.exists(test_vault):
        # Probably an internal fixture failure; clean up after the fact
        shutil.rmtree(test_vault)
    shutil.copytree(
        "./test-vaults/trans-rights-are-human-rights/",
        test_vault
    )
    _install_plugin(test_vault, "../dist/webdav-sync")
    yield test_vault

    shutil.rmtree(test_vault)


@pytest.fixture
def obsidian(vault: str):
    driver = _get_driver()
    _load_vault(driver, vault)
    yield driver

    driver.quit()

def screenshot_impl(obsidian: Chrome, prefix: str, identifier: str, index: int):
    path = os.path.join(
        os.getcwd(),
        SCREENSHOT_DIR,
        prefix,
    )
    if not os.path.exists(path):
        os.makedirs(
            path,
            exist_ok=True
        )

    obsidian.get_screenshot_as_file(
        os.path.join(
            path,
            str(index) + identifier + ".png"
        )
    )


@pytest.fixture
def screenshotter(obsidian: Chrome, request: pytest.FixtureRequest):
    prefix = request.node.name
    index = 0
    def _screenshot(obsidian: Chrome, prefix: str, identifier: str):
        nonlocal index
        screenshot_impl(obsidian, prefix, identifier, index)
        index += 1

    yield partial(_screenshot, obsidian, prefix)

@pytest.fixture
def copyparty():
    def nuke_dirs():
        if os.path.exists(CACHE):
            shutil.rmtree(CACHE)
        if os.path.exists(DATA_DIR):
            shutil.rmtree(DATA_DIR)
    assert os.path.exists("./copyparty.conf"), \
        "You're probably in the wrong working directory"
    CACHE = "./copyparty-cache"
    DATA_DIR = "./copyparty/"
    BASE_URL = "http://localhost:62169"

    nuke_dirs()
    proc = subprocess.Popen(
        ["copyparty", "-c", "./copyparty.conf"]
    )
    sleep(2)
    delay_for_windows_bullshit()
    assert proc.poll() is None, \
        "Failed to start copyparty"

    yield Copyparty(
        BASE_URL,
        DATA_DIR
    )

    try:
        if platform.system() == "Windows":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            subprocess.Popen(
                "Taskkill /PID %d /F" % proc.pid,
                startupinfo=startupinfo
            )
        else:
            proc.kill()
            proc.terminate()
        proc.wait(1 if platform.system() != "Windows" else 10)
    finally:
        try:
            nuke_dirs()
        except Exception as e:
            print(e)
            print("This will be ignored because you're likely on windows, "
                  + "and windows is fucking trash at not locking files. "
                  + "Have fun deleting it if the OS arbitrarily decided "
                  + "that a now dead process still holds the file. "
                  + "(have you considered using a real OS instead?)")

@pytest.fixture
def preloaded_vault(vault: str, copyparty: Copyparty):
    """
    Used to preload the standard vault into copyparty's share. Useful to test
    specific push/pull quirks without needing to actually push first.

    Returns null, as all the actual info is provided by the vault and copyparty
    fixtures. Tests using this fixture that need to know where the vault and
    copyparty share are must explicitly use the vault and copyparty fixtures
    alongside this one:
    ```python3
    def test_trans_rights_are_human_rights(
        vault,
        copyparty,
        preloaded_vault
    ):
        assert 1 == 1
    ```
    """
    # Copytree appears to make its own tree (fucking nice), and copyparty seems
    # to create the root folders as well on boot, hence why dirs_exist_ok is
    # needed.
    shutil.copytree(
        vault,
        copyparty.root_vault_path,
        dirs_exist_ok=True
    )

def _install_plugin(vault_path: str, plugin_dist_path: str):
    if not os.path.exists(plugin_dist_path):
        raise RuntimeError(
            "Developer error: <git root>/dist/webdav-sync doesn't exist"
        )
    shutil.copytree(
        plugin_dist_path,
        # The three hardest problems in software:
        # * Naming things
        # * Cache invalidation
        # * Telling whether directory operations are inclusive or exclusive of
        #   the specified target directory
        os.path.join(
            vault_path,
            ".obsidian",
            "plugins",
            "webdav-sync"
        ),
    )

def _load_vault(driver: Chrome, vault_path: str):
    # Forcibly mock the file dialogs
    # You have no power here, electron >:3
    # (This is necessary because obsidian doesn't provide a CLI)
    execute(driver, """
        electron.remote.dialog.showOpenDialog = async () => {{
            return {{ canceled: false, filePaths: ['{0}'] }};
        }};

        electron.remote.dialog.showOpenDialogSync = () => {{
            return ['{0}'];
        }};
        """.format(vault_path)
    )
    if os.path.exists(vault_path):
        print("Vault found; assuming from the vault fixture")
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if (btn.text == "Open"):
                btn.click()
                break
        else:
            raise RuntimeError("Failed to locate open button")
    else:
        print("Creating new vault")
        # No IDs, brute force
        # This will fall apart if not english
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if (btn.text == "Create"):
                btn.click()
                break
        else:
            raise RuntimeError("Failed to locate create button")

        elem = driver.find_element(
            By.CSS_SELECTOR,
            'input[placeholder="Vault name"]'
        )
        elem.send_keys("trans-rights-are-human-rights")
        sleep(1)

        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if (btn.text == "Browse"):
                btn.click()
                break
        else:
            raise RuntimeError("Failed to initialise URL")

        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if (btn.text == "Create"):
                btn.click()
                break
    try:
        sleep(1)
        driver.page_source

    except NoSuchWindowException:
        assert len(driver.window_handles) == 1
        driver.switch_to.window(driver.window_handles[0])
        # loading plugins inexplicably takes multiple seconds on windows. Not sure why, so this wait needs to be here
        WebDriverWait(
            driver,
            timeout=10,
        ).until(lambda wd : wd.find_element(By.CLASS_NAME, "workspace-ribbon"))

        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if (btn.text == "Trust author and enable plugins"):
                btn.click()
                break
        else:
            screenshot_impl(
                driver,
                "bootstrap", "trust-btn", random.randint(-20000, 20000)
            )
            raise RuntimeError("Failed to locate trust button")
        execute(
            driver,
            """
            app.disableCssTransition();

            0
            """
        )
        close_notices(driver)
        driver.find_element(By.CLASS_NAME, "modal-close-button") \
            .click()
        return
    # No exception means the window wasn't closed. When obsidian boots, it
    # closes the launcher and opens obsidian proper. Under the hood, these are
    # two different windows.
    # If any error occurred during the setup process, we'll end up here. This
    # includes if obsidian's layout has changed in such a way that any of the
    # buttons are borked, or if any of the electron handles are invalid. Have
    # fun debugging, you'll be using interactive python a lot.
    raise RuntimeError("Failed to initialise window")

def _get_driver() -> Chrome:
    """
    Used to create the actual driver. This function exists for special
    debugging purposes via the terminal and interactive python. DO NOT USE FOR
    TESTS! Use the obsidian fixture instead.
    """
    service = create_service()
    opts = ChromeOptions()
    # TODO: add defaults for windows
    if platform.system() != "Windows":
        opts.binary_location = os.environ.get(
            "OBSIDIAN_LOCATION",
            "/usr/bin/obsidian"
        )
    else:
        cache = os.environ.get("OBSIDIAN_LOCATION")
        if opts.binary_location == None:
            raise RuntimeError("You need to specify OBSIDIAN_LOCATION on Windows")
        assert cache is not None
        opts.binary_location = cache
    driver = Chrome(
        service=service,
        options=opts
    )

    # The default timeouts are set low to speed up the tests in the event of
    # failure. THe default is either 10 or 30 (I forget), which is _way_ too
    # long to wait for tests to fail.
    # Obsidian is relatively fast, and because it's an electron app, no weird
    # network conditions need to be addressed in its load.
    # 2 seconds is still too high, but it's either 5 fails (10s default) or
    # 15 fails (30s default) in the time it would take one to fail with the
    # standards.
    # It might be possible to reduce this to 1, but I don't feel like debugging
    # weird edge-cases caused by the CI being slow
    driver.set_script_timeout(2)
    driver.implicitly_wait(2)

    return driver

def create_service():
    return Service(
        DriverUtil.ensure_webdriver()
    )

