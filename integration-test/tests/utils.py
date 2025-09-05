from time import sleep
from typing import Literal
import pytest
from selenium.webdriver import ActionChains, Chrome, Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
import json

from tests.constants import DOWNLOAD_BUTTON_ID, NOTICE_CLASS, UPLOAD_BUTTON_ID

def execute(driver: Chrome, script: str):
    return driver.execute_cdp_cmd(
        "Runtime.evaluate",
        { "expression": script }
    )

def open_settings(driver: Chrome):
    ActionChains(driver) \
        .key_down(Keys.CONTROL) \
        .send_keys("p") \
        .key_up(Keys.CONTROL) \
        .send_keys("Settings") \
        .send_keys(Keys.ENTER) \
        .perform()

    separators = driver.find_elements(
        By.CLASS_NAME,
        "vertical-tab-header-group-title"
    )
    assert len(separators) > 0
    for separator in separators:
        if (separator.text == "Community plugins"):
            break
    else:
        pytest.fail(
            "Canary: failed to open settings"
        )

def click_settings_nav(driver: Chrome, text: str = "WebDAV sync"):
    for elem in driver.find_elements(By.CLASS_NAME, "vertical-tab-nav-item"):
        if text in elem.text:
            elem.click()
            return

    raise RuntimeError("Failed to locate {} in settings menu", text)

def reload(driver: Chrome):
    """
    Uses the command palette to perform a reload.
    DO NOT run this command unnecessarily! This will mostly need to be run once
    per test that uses config, but reloads are a last resort.

    The majority of other choices are better than reloading.
    """
    ActionChains(driver) \
        .key_down(Keys.CONTROL) \
        .send_keys("p") \
        .key_up(Keys.CONTROL) \
        .send_keys("reload") \
        .send_keys(Keys.ENTER) \
        .perform()

def find_setting(driver: Chrome, name: str) -> WebElement:
    """
    Finds and returns a settings-item for a given setting-item-name.
    """
    for item in driver.find_elements(By.CLASS_NAME, "setting-item-name"):
        if item.text == name:
            # Selenium apparently doesn't have built-in support for
            # .parentNode. Not sure why 
            return driver.execute_script(
                "return arguments[0].parentNode.parentNode;",
                item
            )
    raise RuntimeError("Failed to find container")

def find_setting_input(driver: Chrome, name: str) -> WebElement:
    setting_container = find_setting(driver, name)
    return setting_container.find_element(
        By.CLASS_NAME,
        "setting-item-control"
    )

def get_settings_data(driver: Chrome):
    # Extracting objects as anything but a string is annoying
    # TODO: see if  this can be canaried, or if the plugin won't be loaded
    # enough for the state to be populated
    # TODO: msgspec for types maybe? Not sure I want to keep the types synced
    # though...
    return json.loads(execute(
        driver,
        """
        JSON.stringify(app.plugins.plugins["obsidian-webdav-sync"].settings)
        """
    )["result"]["value"])

def default_settings(
    username: Literal["full", "limited"] = "full"
):
    """
    Returns the default settings that'll be used for most tests.
    This doesn't need to be explicitly called unless the object is modified, as
    inject_settings with settings_object = None will call this function
    automagically to get the defaults.
    """
    return {
        "server_conf": {
            "username": username,
            "password": {
                "full": "password",
                "limited": "password2"
            }[username],
            "url": "http://localhost:62169"
        },
        "sync": {
            "full_vault_sync": True,
            "root_folder": {
                "dest": "/vault"
            },
            "subfolders": {},
            "ignore_workspace": True,
        }
    }

def inject_settings(driver: Chrome, settings_object = None):
    """
    Injects the provided settings into the app.
    If settings_object is none, default settings are used.
    """
    if settings_object is None:
        settings_object = default_settings()

    out = execute(
        driver,
        """
        app.plugins.plugins["obsidian-webdav-sync"].settings = JSON.parse('{0}');
        app.plugins.plugins["obsidian-webdav-sync"].saveSettings();
        app.plugins.plugins["obsidian-webdav-sync"].reloadClient();
        0
        """.format(json.dumps(settings_object))
    )
    assert "value" in out["result"], \
        json.dumps(out)
    assert out["result"]["value"] == 0, \
        json.dumps(out)

def close_notices(driver: Chrome):
    for elem in driver.find_elements(
        By.CLASS_NAME,
        NOTICE_CLASS
    ):
        elem.click()

def get_notice_messages(
    driver: Chrome
) -> list[str]:
    return driver.execute_script("""
    let containers = document.getElementsByClassName("notice-container");
    if (containers.length == 0) {
        return [];
    }
    let container = containers[0];
    let notices = container.getElementsByClassName("notice-message");
    let out = [];
    for (const notice of notices) {
        out.push(notice.textContent);
    }
    
    return out;
    """)

def get_ribbon_button(driver: Chrome):
    return driver.find_element(
        By.ID,
        "webdav-ribbon-btn"
    )
def assert_sync_modal_shown(obsidian: Chrome, screenshotter = None):
    try:
        obsidian.find_element(
            By.ID,
            "webdav-sync-modal-header"
        )
    except:
        if screenshotter is not None:
            screenshotter("Fail-OpenModal")
        pytest.fail("Failed to find #webdav-sync-modal-header")

def autoupload(obsidian: Chrome, screenshotter, idx = 0):
    try:
        ribbon = get_ribbon_button(obsidian)
        ribbon.click()
    except Exception as e:
        screenshotter("Fail-unk")
        raise e

    assert_sync_modal_shown(obsidian, screenshotter)
    screenshotter(f"Dialog opened {idx}")

    obsidian.find_element(
        By.ID,
        UPLOAD_BUTTON_ID
    ).click()
    sleep(0.3)
    screenshotter(f"After upload clicked {idx}")

    with pytest.raises(pytest.fail.Exception):
        assert_sync_modal_shown(obsidian)

def autodownload(obsidian: Chrome, screenshotter, idx = 0):
    try:
        ribbon = get_ribbon_button(obsidian)
        ribbon.click()
    except Exception as e:
        screenshotter("Fail-unk")
        raise e

    assert_sync_modal_shown(obsidian, screenshotter)
    screenshotter("Dialog opened {idx}")

    obsidian.find_element(
        By.ID,
        DOWNLOAD_BUTTON_ID
    ).click()
    sleep(0.3)
    screenshotter("After download clicked {idx}")

    with pytest.raises(pytest.fail.Exception):
        assert_sync_modal_shown(obsidian)
