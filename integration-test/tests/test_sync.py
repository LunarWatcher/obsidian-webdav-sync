from selenium.webdriver import Chrome
from selenium.webdriver.common.by import By

from tests.utils import click_settings_nav, inject_settings, open_settings


def test_server_connection(obsidian: Chrome, copyparty, screenshotter):
    search_str = "Connection succeeded. Found folder with "
    inject_settings(obsidian)

    open_settings(obsidian)
    click_settings_nav(obsidian)
    screenshotter("Settings opened")

    elem = obsidian.find_element(
        By.ID,
        "webdav-settings-test-connection"
    )
    elem.click()
    notice_container = obsidian.find_element(
        By.CLASS_NAME, "notice-container"
    )
    screenshotter("After button click")
    msg = notice_container.find_element(
        By.CLASS_NAME,
        "notice-message"
    ).text
    assert search_str in msg, msg

