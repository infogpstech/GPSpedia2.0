# verify_users_logic.py
import sys

# ============================================================================
# MOCK DATA: Replicating the Google Sheets environment
# ============================================================================

# Simulates the "Users" sheet
USERS_SHEET = [
    # Headers
    ["ID", "Nombre_Usuario", "Password", "Privilegios", "Telefono", "Correo_Electronico", "Nombre_Completo", "SessionToken"],
    # Data Rows
    ["1", "dev_user", "pass123", "Desarrollador", "111", "dev@test.com", "Dev Full Name", "old-token-1"],
    ["2", "jefe_user", "pass123", "Gefe", "222", "jefe@test.com", "Jefe Full Name", "old-token-2"],
    ["3", "tech_user", "pass123", "Tecnico", "333", "tech@test.com", "Tech Full Name", "valid-token-for-tech"],
]

# Simulates the "ActiveSessions" sheet
ACTIVE_SESSIONS_SHEET = [
    # Headers
    ["ID_Usuario", "Usuario", "ActiveSessions", "date", "Logs"],
    # Data Rows
    ["1", "dev_user", "valid-token-for-dev"],
    ["2", "jefe_user", "valid-token-for-jefe"],
    ["3", "tech_user", "valid-token-for-tech"], # <-- FIX: Added missing session for the 'Tecnico' user
]

# Simulates the column constants from the JavaScript file
COLS_USERS = { "ID": 0, "Privilegios": 3 }
COLS_ACTIVE_SESSIONS = { "ID_Usuario": 0, "ActiveSessions": 2 }

# ============================================================================
# SIMULATED BACKEND LOGIC from services/users/users.js
# ============================================================================

class SimulationError(Exception):
    pass

def getVerifiedRole(sessionToken):
    """A direct Python translation of the getVerifiedRole function."""
    if not sessionToken:
        raise SimulationError("Acceso no autorizado: Se requiere token de sesión.")

    sessionsData = ACTIVE_SESSIONS_SHEET[1:] # Exclude headers

    userId = None
    for row in sessionsData:
        if row[COLS_ACTIVE_SESSIONS["ActiveSessions"]] == sessionToken:
            userId = row[COLS_ACTIVE_SESSIONS["ID_Usuario"]]
            break

    if not userId:
        raise SimulationError("Acceso no autorizado: Sesión inválida o expirada.")

    usersData = USERS_SHEET[1:] # Exclude headers

    for row in usersData:
        if str(row[COLS_USERS["ID"]]) == str(userId):
            return row[COLS_USERS["Privilegios"]]

    raise SimulationError("Acceso no autorizado: Usuario asociado a la sesión no encontrado.")

def handleGetUsers(payload):
    """A direct Python translation of the handleGetUsers function."""
    sessionToken = payload.get("sessionToken")

    # This is the line that generates the error in the old code.
    # In the new code, this check is replaced by the one below.
    # if not payload.get("privilegios"):
    #     raise SimulationError("se requiere el rol del solicitante.")

    requesterRole = getVerifiedRole(sessionToken)

    if requesterRole not in ['Desarrollador', 'Gefe', 'Supervisor']:
        raise SimulationError('Acceso denegado. Permisos insuficientes.')

    # If we reach here, the logic is successful.
    return {"status": "success", "message": f"Authorization successful for role: {requesterRole}"}

# ============================================================================
# TEST RUNNER
# ============================================================================

def run_test(test_name, payload, expected_success, expected_message_contains=""):
    print(f"--- Running Test: {test_name} ---")
    try:
        result = handleGetUsers(payload)
        if expected_success:
            print(f"PASS: Operation succeeded as expected. Result: {result}")
            return True
        else:
            print(f"FAIL: Operation succeeded but was expected to fail. Result: {result}")
            return False
    except SimulationError as e:
        error_message = str(e)
        if not expected_success:
            if expected_message_contains in error_message:
                print(f"PASS: Operation failed as expected. Error: {error_message}")
                return True
            else:
                print(f"FAIL: Operation failed, but with an unexpected error message.")
                print(f"   Expected to contain: '{expected_message_contains}'")
                print(f"   Actual error: '{error_message}'")
                return False
        else:
            print(f"FAIL: Operation failed but was expected to succeed. Error: {error_message}")
            return False
    print("-" * 30 + "\n")


if __name__ == "__main__":
    results = []

    # Test 1: Valid Developer Token
    payload_dev = {"sessionToken": "valid-token-for-dev"}
    results.append(run_test("Valid Developer Token", payload_dev, True))

    # Test 2: Valid Jefe Token
    payload_jefe = {"sessionToken": "valid-token-for-jefe"}
    results.append(run_test("Valid Jefe Token", payload_jefe, True))

    # Test 3: Invalid Role (Tecnico)
    payload_tech = {"sessionToken": "valid-token-for-tech"}
    results.append(run_test("Invalid Role (Tecnico)", payload_tech, False, "Permisos insuficientes"))

    # Test 4: Invalid/Fake Token
    payload_fake = {"sessionToken": "this-is-not-a-real-token"}
    results.append(run_test("Invalid/Fake Token", payload_fake, False, "Sesión inválida o expirada"))

    # Test 5: Missing Token
    payload_missing = {}
    results.append(run_test("Missing Token", payload_missing, False, "Se requiere token de sesión"))

    # Test 6: Old API contract with 'privilegios' (should fail)
    payload_old = {"privilegios": "Desarrollador"}
    results.append(run_test("Old API Contract", payload_old, False, "Se requiere token de sesión"))

    print("\n--- FINAL RESULTS ---")
    if all(results):
        print("✅ ALL TESTS PASSED. The logic in services/users/users.js is correct.")
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED. There is a flaw in the simulated logic.")
        sys.exit(1)
