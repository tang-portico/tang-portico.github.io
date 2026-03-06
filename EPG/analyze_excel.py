import pandas as pd
import warnings
warnings.filterwarnings('ignore')

files = {
    'file1': '1-國外原檔-260220 ROCK Entertainment March 2026 EPG Affiliates (GMT+8)_CHI_Revised 1.xlsx',
    'file2': '2-製作檔案-(K)0204 ROCK-Entertainment-202603.xlsx',
    'file3': '3-平台檔案-384.xls',
    'dict': '中英文節目-Entertainment 節目中文譯名資料庫.xlsx'
}

for name, path in files.items():
    print(f"========== {name} ==========")
    try:
        df = pd.read_excel(path)
        print("Shape:", df.shape)
        # Check first column to see if there are many unnameds
        print("First 5 rows (first 10 cols):")
        print(df.iloc[:5, :10].to_string())
        print("\n")
    except Exception as e:
        print(f"Error reading {name}: {e}")
