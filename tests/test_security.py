from jose import JWTError

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hashing_is_one_way_and_verifiable() -> None:
    # ensure plaintext passwords never remain as stored credentials
    password = "correct-horse-battery-staple"
    hashed_password = hash_password(password)

    assert hashed_password != password
    assert verify_password(password, hashed_password) is True
    assert verify_password("wrong-password", hashed_password) is False


def test_access_token_round_trip_and_tamper_rejection() -> None:
    # verify signed JWT payloads can be decoded and tampered tokens are rejected
    token = create_access_token({"user_id": 123, "role": "CLIENT"})
    payload = decode_access_token(token)

    assert payload["user_id"] == 123
    assert payload["role"] == "CLIENT"

    try:
        decode_access_token(f"{token}tampered")
    except JWTError:
        tampered_rejected = True
    else:
        tampered_rejected = False

    assert tampered_rejected is True
