import sys
import re

path = 'js/app.js'
with open(path, 'rb') as f:
    content = f.read().decode('utf-8')

# 1. Update formatScore
old_format = r'const formatScore = \(num\) => Number\.isInteger\(num\) \? num : num\.toFixed\(1\);'
new_format = '''// 🌟 [ABBREVIATION] แปลงตัวเลขเยอะๆ ให้มีตัวย่อ เช่น 1.2k เพื่อไม่ให้ตัวเลขชนกันในหน้าจอ
    const formatScore = (num) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return Number.isInteger(num) ? num : num.toFixed(1);
    };'''
content = re.sub(old_format, new_format, content)

# 2. Update SET Style baseline
old_set = r'const prevVal = raw\.length > 1 \? raw\[raw\.length - 2\] : 1000;\s+const diff = \(currentVal - prevVal\)\.toFixed\(2\);\s+const percent = \(\(diff / prevVal\) \* 100\)\.toFixed\(2\);'
new_set = '''const prevVal = raw.length > 1 ? raw[raw.length - 2] : 0;
        const diff = (currentVal - prevVal).toFixed(2);
        const percent = prevVal > 0 ? ((diff / prevVal) * 100).toFixed(2) : '100.00';'''
content = re.sub(old_set, new_set, content)

with open(path, 'wb') as f:
    f.write(content.encode('utf-8'))
print("Success")
