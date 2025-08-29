import pytest
from selenium.common.exceptions import NoSuchWindowException
from selenium.webdriver import Chrome, ChromeOptions
import os
from time import sleep

from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
import shutil

@pytest.fixture
def vault():
    dummy_vault = os.path.join(os.getcwd(), "test_vault")
    yield dummy_vault

    shutil.rmtree(dummy_vault)

@pytest.fixture
def obsidian(vault: str):
    driver = _get_driver()
    _load_vault(driver, vault)
    yield driver

    driver.quit()

def _load_vault(driver: Chrome, vault_path: str):
    # No IDs, brute force
    # This will fall apart if not english
    for btn in driver.find_elements(By.TAG_NAME, "button"):
        if (btn.text == "Create"):
            btn.click()
            break
    else:
        raise RuntimeError("Failed to locate create button")

    # Forcibly mock the file dialogs
    # You have no power here, electron >:3
    # (This is necessary because obsidian doesn't provide a CLI)
    driver.execute_cdp_cmd(
        "Runtime.evaluate",
        {"expression": """
            electron.remote.dialog.showOpenDialog = async () => {{
                return {{ canceled: false, filePaths: ['{0}'] }};
            }};

            electron.remote.dialog.showOpenDialogSync = () => {{
                return ['{0}'];
            }};
            """.format(vault_path)
         }
    )

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

    try:
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if (btn.text == "Create"):
                btn.click()
                break
        sleep(1)
        driver.page_source

    except NoSuchWindowException:
        assert len(driver.window_handles) == 1
        driver.switch_to.window(driver.window_handles[0])
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
    return driver


def create_service():
    return Service(
        # TODO: probably not portable
        "../node_modules/.bin/chromedriver"
    )

