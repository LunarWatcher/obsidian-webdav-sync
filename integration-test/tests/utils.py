import pytest
from selenium.webdriver import ActionChains, Chrome, Keys
from selenium.webdriver.common.by import By

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

