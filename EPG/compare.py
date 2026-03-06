import pandas as pd
import warnings
warnings.filterwarnings('ignore')
import re

# Load the original dictionary and files
dict_df = pd.read_excel('中英文節目-Entertainment 節目中文譯名資料庫.xlsx')
dict_map = {}
for _, row in dict_df.iterrows():
    en_raw = str(row.get('節目英文名稱資料庫', row.get('節目英文名稱', ''))).strip()
    if en_raw and en_raw != 'nan':
        dict_map[en_raw.lower()] = {
            'enOriginal': en_raw,
            'zhTitle': str(row.get('節目中文譯名資料庫', row.get('節目中文譯名', ''))).strip(),
            'category': str(row.get('分類', '')).strip(),
            'rating': str(row.get('節目分級', '')).strip()
        }

def extract_season(s):
    match = re.search(r'S(?:eason\s*)?0*(\d+)', s, re.IGNORECASE)
    return match.group(1) if match else ''

def levenshtein(s1, s2):
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def string_sim(s1, s2):
    longer = s1 if len(s1) > len(s2) else s2
    shorter = s2 if len(s1) > len(s2) else s1
    if len(longer) == 0: return 1.0
    dist = levenshtein(longer, shorter)
    lev_score = (len(longer) - dist) / len(longer)
    
    clean_longer = re.sub(r'[^a-z0-9]', '', longer.lower())
    clean_shorter = re.sub(r'[^a-z0-9]', '', shorter.lower())
    char_score = 0
    if len(clean_shorter) > 0 and clean_shorter in clean_longer:
        if len(clean_shorter) / len(clean_longer) >= 0.5:
            char_score = 0.96
    return max(lev_score, char_score)

df1 = pd.read_excel('1-國外原檔-260220 ROCK Entertainment March 2026 EPG Affiliates (GMT+8)_CHI_Revised 1.xlsx')

# Step 1 Mock Logic
results = []
for idx, row in df1.iterrows():
    en_raw = str(row.get('Title (English)', row.get('Title', ''))).strip()
    search_title = en_raw.lower()
    
    zh_title = ''
    final_en = en_raw
    
    if search_title in dict_map:
        final_en = dict_map[search_title]['enOriginal']
        zh_title = dict_map[search_title]['zhTitle']
    else:
        base_match = re.match(r'^(.*?)(?:\s+(?:season|s\d+).*$|$)', search_title, re.IGNORECASE)
        base_title = base_match.group(1).strip() if base_match else search_title
        if base_title in dict_map:
            final_en = dict_map[base_title]['enOriginal']
            zh_title = dict_map[base_title]['zhTitle']
        else:
            best_key = None
            best_sim = 0
            search_s = extract_season(en_raw)
            for k in dict_map.keys():
                sim = string_sim(base_title, k)
                dict_s = extract_season(k)
                if search_s and dict_s and search_s != dict_s:
                    sim = 0
                if sim > best_sim:
                    best_sim = sim
                    best_key = k
            if best_sim >= 0.95 and best_key:
                final_en = dict_map[best_key]['enOriginal']
                zh_title = dict_map[best_key]['zhTitle']
            else:
                final_en = en_raw
                zh_title = en_raw
                
    results.append({
        'Auto_EN': final_en,
        'Auto_ZH': zh_title
    })

auto_df = pd.DataFrame(results)

# Compare with Manual Step 2/3 names
df2_manual = pd.read_excel('2-製作檔案-(K)0204 ROCK-Entertainment-202603.xlsx')
# df3_manual = pd.read_excel('3-平台檔案-384.xls')

diffs = []
for i in range(min(len(auto_df), len(df2_manual))):
    auto_en = auto_df.iloc[i]['Auto_EN']
    auto_zh = auto_df.iloc[i]['Auto_ZH']
    
    man_en = str(df2_manual.iloc[i]['英文片名']).strip()
    man_zh = str(df2_manual.iloc[i]['中文片名']).strip()
    
    if auto_en != man_en or auto_zh != man_zh:
        # Ignore minor nan diffs
        if man_en == 'nan' and auto_en == '': continue
        if man_zh == 'nan' and auto_zh == '': continue
        if man_zh == auto_zh and man_en == auto_en: continue
        
        diffs.append({
            'Row': i + 2,
            'Auto_EN': auto_en,
            'Man_EN': man_en,
            'Auto_ZH': auto_zh,
            'Man_ZH': man_zh
        })

print(f"Total differences found: {len(diffs)}")
if len(diffs) > 0:
    diff_df = pd.DataFrame(diffs)
    print(diff_df.head(20).to_string())
    print("...")
    
