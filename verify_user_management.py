import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Inject session and API manager
        await page.goto("about:blank")
        await page.context.add_init_script("""
            localStorage.setItem('gpsepedia_session', JSON.stringify({
                "Id_Usuario": "U-001",
                "Nombre_Usuario": "Jules",
                "Nombre_Completo": "Jules Verne",
                "Privilegios": "Desarrollador",
                "SessionToken": "valid_token_for_jules"
            }));
        """)
        SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec"
        await page.context.add_init_script(f"const SCRIPT_URL = '{SCRIPT_URL}';")
        with open('api.js', 'r') as f:
            api_manager_content = f.read()
        await page.context.add_init_script(api_manager_content)

        # Mock API responses
        async def mock_api(route, request):
            if request.method != "POST" or not request.post_data_json:
                await route.continue_()
                return

            post_data = request.post_data_json
            action = post_data.get("action")

            if action == "changePassword":
                await route.fulfill(status=200, content_type="application/json", body='{"status":"success"}')
            elif action == "createUser":
                await route.fulfill(status=200, content_type="application/json", body='{"status":"success"}')
            elif action == "getUsers":
                 await route.fulfill(status=200, content_type="application/json", body='{"status":"success", "users": []}')
            else:
                await route.continue_()

        await page.context.route(SCRIPT_URL, mock_api)

        # Start server and navigate
        os.system("kill $(lsof -t -i:8000) 2>/dev/null || true")
        os.system("python3 -m http.server 8000 > server.log 2>&1 &")
        await asyncio.sleep(1)
        await page.goto("http://localhost:8000/users.html")

        # --- Test Change Password ---
        await page.click("#change-password-btn")
        await page.wait_for_selector("div#password-modal", state="visible") # Specific selector
        print("Password modal is visible.")
        await page.fill("#current-password", "password123")
        await page.fill("#new-password", "newpassword123")
        await page.fill("#confirm-password", "newpassword123")
        await page.click("#password-form button[type=submit]")
        await page.wait_for_selector("div#password-modal", state="hidden") # Specific selector
        print("Password changed successfully.")

        # --- Test Create User ---
        await page.click("#create-user-btn")
        await page.wait_for_selector("#user-modal", state="visible")
        print("User modal is visible.")
        await page.fill("#fullname", "Test User")
        await page.fill("#username-modal", "testuser")
        await page.select_option("#role", "Tecnico")
        await page.fill("#password-modal", "password123")
        await page.click("#user-form button[type=submit]")
        await page.wait_for_selector("#user-modal", state="hidden")
        print("User created successfully.")

        print("User management verification completed!")

        screenshot_path = "/home/jules/verification/user_management_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()
        os.system("kill $(lsof -t -i:8000) 2>/dev/null || true")

asyncio.run(main())
