import requests
from selenium.webdriver import Chrome
from selenium.webdriver.common.by import By

from tests.utils import click_settings_nav, open_settings

def test_buttons_visible_and_functional(obsidian: Chrome):
    assert obsidian.find_element(By.ID, "webdav-ribbon-btn") is not None
    open_settings(obsidian)
    click_settings_nav(obsidian)

    assert obsidian.find_element(By.ID, "webdav-sync-settings-header")

def test_copyparty_fixture(copyparty: str):
    res = requests.get(
        copyparty
    )

    assert res.status_code == 200
    assert "howdy stranger" in res.text
