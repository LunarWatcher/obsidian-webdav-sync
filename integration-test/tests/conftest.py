import os
import shutil
import subprocess
from time import sleep
import platform

import pytest
from selenium.common.exceptions import NoSuchWindowException
from selenium.webdriver import Chrome, ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

from tests.utils import execute

@pytest.fixture
def vault():
    test_vault = os.path.join(os.getcwd(), "test_vault")
    if os.path.exists(test_vault):
        # Probably an internal fixture failure; clean up after the fact
        shutil.rmtree(test_vault)
    shutil.copytree(
        "./test-vaults/trans-rights-are-human-rights/",
        test_vault
    )
    _install_plugin(test_vault, "../dist/obsidian-webdav-sync")
    yield test_vault

    shutil.rmtree(test_vault)

@pytest.fixture
def obsidian(vault: str):
    driver = _get_driver()
    _load_vault(driver, vault)
    yield driver

    driver.quit()

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
    assert proc.poll() is None, \
        "Failed to start copyparty"

    yield BASE_URL

    try:
        proc.terminate()
        proc.wait(1)
    finally:
        nuke_dirs()

def _install_plugin(vault_path: str, plugin_dist_path: str):
    if not os.path.exists(plugin_dist_path):
        raise RuntimeError(
            "Developer error: <git root>/dist/obsidian-webdav-sync doesn't exist"
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
            "obsidian-webdav-sync"
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

        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if (btn.text == "Trust author and enable plugins"):
                btn.click()
                break
        else:
            raise RuntimeError("Failed to locate trust button")

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
    opts.binary_location = os.environ.get(
        "OBSIDIAN_LOCATION",
        "/usr/bin/obsidian"
    )
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
        # TODO: probably not portable, I assume windows has chromedriver.exe
        "../node_modules/.bin/chromedriver" if platform.system() != "Windows"
        else r"..\node_modules\.bin\chromedriver.cmd"
    )

