# verify_full_fix.py
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Mock session data - THIS IS CRITICAL
        # This simulates the corrected auth.js backend, including Nombre_Completo
        mock_session = {
            "ID": "1",
            "Nombre_Usuario": "testuser",
            "Nombre_Completo": "Test User Full Name",
            "Privilegios": "Desarrollador",
            "SessionToken": "valid-token-123"
        }

        # Mock the API responses to isolate the frontend logic
        async def handle_route(route):
            request = route.request
            if "script.google.com" in request.url:
                payload = request.post_data_json
                action = payload.get("action")

                if action == "validateSession":
                    print(f"Mocking action: {action}")
                    await route.fulfill(status=200, content_type="text/plain", body='{"valid":true}')
                    return

                if action == "getCatalogData":
                     print(f"Mocking action: {action}")
                     # Return minimal valid catalog data to allow the UI to render
                     await route.fulfill(status=200, content_type="text/plain", body='{"cortes": [{"id":1, "marca":"Test"}], "tutoriales":[], "relay":[]}')
                     return

                if action == "getUsers":
                    print(f"Mocking action: {action}")
                    # Verify the frontend is sending the correct token
                    if payload.get("payload", {}).get("sessionToken") == "valid-token-123":
                        print("Mocking successful getUsers response.")
                        await route.fulfill(status=200, content_type="text/plain", body='{"status":"success","users":[{"ID":"1","Nombre_Usuario":"testuser","Nombre_Completo":"Test User Full Name","Privilegios":"Desarrollador"}]}')
                    else:
                        print("Mocking failed getUsers response due to invalid token.")
                        await route.fulfill(status=401, content_type="text/plain", body='{"status":"error","message":"Unauthorized"}')
                    return

            await route.continue_()

        await page.route("**/*", handle_route)

        # --- Verification Step 1: Catalog Loading Fix ---
        print("Navigating to index.html...")
        await page.goto("http://localhost:8000/index.html")

        # Inject session *after* navigating to establish origin
        print("Injecting session data into localStorage...")
        await page.evaluate(f'localStorage.setItem("gpsepedia_session", JSON.stringify({mock_session!r}))')

        # Reload for the app to use the session
        print("Reloading page...")
        await page.reload()

        print("Waiting for main container to be visible...")
        main_container = page.locator(".container")
        await expect(main_container).to_be_visible(timeout=5000)
        print("SUCCESS: Main container is visible. Catalog loading fix is verified.")

        # --- Verification Step 2: User Profile and Data Fix ---
        print("Navigating to users.html...")
        await page.goto("http://localhost:8000/users.html")

        print("Waiting for profile full name to be visible...")
        profile_fullname = page.locator("#profile-fullname")
        await expect(profile_fullname).to_have_text("Test User Full Name", timeout=5000)
        print("SUCCESS: Profile 'Nombre Completo' is correctly displayed.")

        print("Waiting for user table to be populated...")
        user_row = page.locator(".user-table tbody tr")
        await expect(user_row).to_have_count(1, timeout=5000)
        print("SUCCESS: User table is populated. getUsers call with sessionToken is verified.")

        screenshot_path = "full_fix_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())