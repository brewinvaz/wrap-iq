from app.auth.passwords import hash_password, verify_password


def test_hash_and_verify():
    password = "mysecretpassword"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True


def test_wrong_password():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False
