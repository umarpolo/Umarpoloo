import math

def kalkulator(rumus: str) -> str:
        try:
                # Batasi fungsi yang boleh digunakan
                allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith("__")}
                # Tambahkan fungsi built-in yang aman
                allowed_names.update({
                        'abs': abs,
                        'round': round,
                        'min': min,
                        'max': max,
                })
                # Evaluasi rumus dengan namespace terbatas
                result = eval(rumus, {"__builtins__": None}, allowed_names)
                return str(result)
        except Exception as e:
                return f"Error: rumus tidak valid ({e})"

if __name__ == "__main__":
        import sys
        if len(sys.argv) > 1:
                expr = " ".join(sys.argv[1:])
                print(kalkulator(expr))
        else:
                print("Usage: python kalkulator.py <rumus>")
