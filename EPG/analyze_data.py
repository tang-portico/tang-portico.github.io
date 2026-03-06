import pandas as pd
import warnings
warnings.filterwarnings('ignore')

files1 = '1-國外原檔-260220 ROCK Entertainment March 2026 EPG Affiliates (GMT+8)_CHI_Revised 1.xlsx'
files2 = '2-製作檔案-(K)0204 ROCK-Entertainment-202603.xlsx'
files3 = '3-平台檔案-384.xls'

print("--- File 2 Sample ---")
df2 = pd.read_excel(files2)
print(df2.head(10).to_string())

print("\n--- File 3 Sample ---")
df3 = pd.read_excel(files3)
print(df3.head(10).to_string())
