from time import sleep
from selenium.webdriver import Chrome
from selenium.webdriver.common.by import By


def test_buttons_visible(obsidian: Chrome):
    assert obsidian.find_element(By.ID, "webdav-ribbon-btn") is not None
