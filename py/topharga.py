import requests

def get_top_price():
    try:
        url = 'https://api.coingecko.com/api/v3/coins/markets'
        params = {
            'vs_currency': 'usd',
            'order': 'market_cap_desc',
            'per_page': 100,
            'page': 1,
            'sparkline': False
        }
        r = requests.get(url, params=params)
        data = r.json()

        # Filter out coin tanpa harga
        filtered = [coin for coin in data if coin.get('current_price') is not None]
        top_by_price = sorted(filtered, key=lambda x: x['current_price'], reverse=True)[:10]

        result = '💰 *Top 10 Coin dengan Harga Tertinggi Saat Ini*\n\n'
        for i, coin in enumerate(top_by_price, start=1):
            name = coin.get('name', 'Unknown')
            symbol = coin.get('symbol', '').upper()
            price_usd = coin['current_price']
            idr = int(price_usd * 15700)
            result += f"{i}. {name} ({symbol})\n   ${price_usd:,.2f} | Rp{idr:,.0f}\n"

        return result.strip()
    except Exception as e:
        return f"Error: {e}"

if __name__ == '__main__':
    print(get_top_price())
