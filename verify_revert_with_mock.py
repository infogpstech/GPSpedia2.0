
import asyncio
from playwright.async_api import async_playwright
import os
import json

async def handle_route(route, request):
    """
    Handles network requests for mocking.
    """
    action_map = {
        "https://script.google.com/macros/s/AKfycby86oaNWKj9Z3sXWs-tXJn2eIgU9QcpjaC6cyYReswtc_WSypt3fFtQ-3aAs58ZMa72/exec": {
            "validateSession": {"valid": True},
        },
        "https://script.google.com/macros/s/AKfycbzUdYI2MpBcXvXsNZvfBTbsDmBBzFgsqONemSd6vjwGEP2jls_eIVjXylU-nXgWa7-m7A/exec": {
            "getCatalogData": {"data": {"cortes": [], "sortedCategories": [], "tutoriales": [], "relay": [], "logos": []}},
        }
    }

    url = request.url
    post_data = request.post_data_json if request.method == "POST" and request.post_data else {}
    action = post_data.get("action")

    if url in action_map and action in action_map[url]:
        response_body = action_map[url][action]
        print(f"Mocking action '{action}' at '{url}' with response: {response_body}")
        await route.fulfill(
            status=200,
            content_type="text/plain", # Apps Script returns text/plain
            body=json.dumps(response_body)
        )
    else:
        # Let other requests pass through
        await route.continue_()

async def main():
    """
    Main function to run the Playwright script with network mocking.
    """
    session_data_str = os.environ.get("SESSION_DATA")
    if not session_data_str:
        print("Error: SESSION_DATA environment variable not set.")
        return

    try:
        session_data = json.loads(session_data_str)
        print("Successfully parsed session data.")
    except json.JSONDecodeError as e:
        print(f"Error parsing SESSION_DATA JSON: {e}")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                storage_state={"origins": [{
                    "origin": "http://localhost:8000",
                    "localStorage": [{
                        "name": "gpsepedia_session",
                        "value": json.dumps(session_data)
                    }]
                }]}
            )
            print("Browser context created with session data.")
        except Exception as e:
            print(f"Error creating browser context: {e}")
            await browser.close()
            return

        page = await context.new_page()

        # Set up network interception
        await page.route("**/*", handle_route)
        print("Network routing for mocking has been set up.")

        try:
            # Navigate to the page
            await page.goto("http://localhost:8000/index.html", wait_until="networkidle", timeout=20000)
            print("Navigation to index.html successful.")

            # The splash screen should hide automatically
            await page.wait_for_selector("#splash-screen", state="hidden", timeout=10000)
            print("Splash screen is hidden.")

            # Wait for the main container to be visible
            await page.wait_for_selector(".container", state="visible", timeout=15000)
            print("Main container '.container' is visible.")

            # Take a screenshot
            screenshot_path = "revert_verification_mocked.png"
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"An error occurred during page interaction: {e}")
            await page.screenshot(path="revert_error_mocked.png")
            print("Error screenshot saved to revert_error_mocked.png")
        finally:
            await browser.close()
            print("Browser closed.")

if __name__ == "__main__":
    asyncio.run(main())
