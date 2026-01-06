import pytest
from playwright.sync_api import sync_playwright, Page, expect, Route, Request
import json

# --- Mock Data ---

MOCK_SESSION = {
    "status": "success",
    "user": {
        "ID": "user-id-123",
        "Nombre_Usuario": "testuser",
        "Rol": "Usuario",
        "Email": "test@example.com"
    },
    "token": "mock-session-token-abc-123"
}

MOCK_CATALOG_DATA = {
    "cortes": [
        {"id": 1, "categoria": "Sedan", "marca": "Toyota", "modelo": "Corolla", "anoDesde": 2020, "imagenVehiculo": "img1.jpg", "timestamp": "2026-01-05T10:00:00Z"},
        {"id": 2, "categoria": "SUV", "marca": "Honda", "modelo": "CR-V", "anoDesde": 2021, "imagenVehiculo": "img2.jpg", "timestamp": "2026-01-05T11:00:00Z"},
        {"id": 3, "categoria": "Sedan", "marca": "Toyota", "modelo": "Camry", "anoDesde": 2022, "imagenVehiculo": "img3.jpg", "timestamp": "2026-01-05T12:00:00Z"},
        {"id": 4, "categoria": "Motocicletas", "marca": "Honda", "modelo": "CBR500R", "anoDesde": 2022, "imagenVehiculo": "img4.jpg", "timestamp": "2026-01-05T13:00:00Z"}
    ],
    "tutoriales": [],
    "relay": [],
    "logos": [
        {"nombreMarca": "Toyota", "urlLogo": "logo_toyota.png"},
        {"nombreMarca": "Honda", "urlLogo": "logo_honda.png"},
        {"nombreMarca": "Honda Motocicletas", "urlLogo": "logo_honda_moto.png"}
    ]
}

def handle_api_route(route: Route, request: Request):
    """
    Intercepts and mocks all API calls to the Google Apps Script backend.
    """
    if request.method != 'POST':
        return route.continue_()

    payload = request.post_data_json
    action = payload.get('action')

    response_body = {}
    status = 200

    if action == 'validateSession':
        response_body = {"valid": False, "user": None}
    elif action == 'login':
        response_body = MOCK_SESSION
    elif action == 'getCatalogData':
        response_body = MOCK_CATALOG_DATA
    else:
        response_body = {"status": "success", "message": f"Mocked {action}"}

    print(f"Mocking action: {action} -> Response: {response_body}")

    return route.fulfill(
        status=status,
        headers={"Content-Type": "text/plain;charset=utf-8"},
        body=json.dumps(response_body)
    )


def test_refactor_verification(page: Page):
    """
    Tests the core user flows after the major refactoring.
    """
    page.route("**/exec", handle_api_route)

    page.goto("http://localhost:8000")

    # The app is now fast enough that we can directly wait for the login modal.
    expect(page.locator("#login-modal")).to_be_visible(timeout=10000)
    expect(page.locator("#username")).to_be_visible()
    expect(page.locator("#password")).to_be_visible()
    print("Login screen visible as expected.")

    page.fill("#username", "testuser")
    page.fill("#password", "password123")
    page.click("button[type='submit']")
    print("Login submitted.")

    expect(page.locator("#splash-screen")).to_be_hidden(timeout=10000)

    # Wait for the main content to be rendered by showApp -> mostrarCategorias
    # This is a more reliable check than just the container's visibility.
    expect(page.locator("h4:text('Últimos Agregados')")).to_be_visible(timeout=10000)
    print("Main content is visible after login.")
    expect(page.locator(".carousel-track .card")).to_have_count(4)
    print("Catalog data rendered successfully.")

    page.click("h4:text('Búsqueda por Categoría') + .carousel-container .card:has-text('Sedan')")

    expect(page.locator("h4:text('Marcas de Sedan')")).to_be_visible()
    expect(page.locator(".card.brand-logo-item img[alt='Marca Toyota']")).to_be_visible()
    print("Navigated to Brands section successfully.")

    page.click(".card.brand-logo-item img[alt='Marca Toyota']")

    expect(page.locator("h4:text('Modelos de Toyota')")).to_be_visible()
    expect(page.locator(".card:has-text('Corolla')")).to_be_visible()
    expect(page.locator(".card:has-text('Camry')")).to_be_visible()
    print("Navigated to Models section successfully.")

    page.click("span.backBtn:text('Volver')")
    page.click("span.backBtn:text('Volver')")

    expect(page.locator("h4:text('Últimos Agregados')")).to_be_visible()
    print("Navigated back to main view.")

    search_input = page.locator("#searchInput")
    search_input.fill("Corolla")

    expect(page.locator("h4:text('Resultados de búsqueda para: \"corolla\"')")).to_be_visible()
    expect(page.locator(".card.brand-logo-item")).to_have_count(1)
    expect(page.locator(".card.brand-logo-item img[alt='Marca Toyota']")).to_be_visible()
    print("Search results displayed correctly.")

    page.click(".card.brand-logo-item img[alt='Marca Toyota']")
    page.click(".card:has-text('Corolla')")

    expect(page.locator("#modalDetalle")).to_be_visible()
    expect(page.locator("#detalleCompleto h2:text('Corolla')")).to_be_visible()
    print("Detail modal opened successfully from search.")

    screenshot_path = "verification_screenshot.png"
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved to {screenshot_path}")

    page.click("#modalDetalle button:text('Cerrar')")
    expect(page.locator("#modalDetalle")).to_be_hidden()
    expect(page.locator("h4:text('Modelos de Toyota')")).to_be_visible()
    print("Modal closed, returned to previous view.")
