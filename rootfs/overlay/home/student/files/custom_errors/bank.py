"""A tiny bank account that refuses bad withdrawals with its own exceptions.

    python3 bank.py
"""


class BankError(Exception):
    """Base class for every error this module raises."""


class InsufficientFunds(BankError):
    """Raised when a withdrawal is larger than the balance."""

    def __init__(self, balance, amount):
        super().__init__(f"balance {balance}, tried to withdraw {amount}")
        self.balance = balance
        self.amount = amount


class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError(f"amount must be positive, got {amount}")
        if amount > self.balance:
            raise InsufficientFunds(self.balance, amount)
        self.balance -= amount
        return self.balance


if __name__ == "__main__":
    account = Account("민지", 10000)
    for amount in [3000, -500, 20000, 7000]:
        try:
            left = account.withdraw(amount)
        except InsufficientFunds as e:
            print(f"withdraw {amount}: refused, short by {e.amount - e.balance} ({e})")
        except ValueError as e:
            print(f"withdraw {amount}: invalid ({e})")
        else:
            print(f"withdraw {amount}: ok, balance {left}")
