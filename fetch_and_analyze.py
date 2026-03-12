#!/usr/bin/env python3
"""
GitHub AI 雷达 - 数据获取与 AI 分析脚本
每日自动获取 GitHub Python 趋势项目并进行 VC 视角分析
"""

import json
import os
import sys
import re
import urllib.request
import urllib.error
from datetime import datetime
from typing import List, Dict, Any

# GitHub API 配置
GITHUB_API_BASE = "https://api.github.com"
# 使用 GitHub Token 提高 API 限制
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

def get_headers():
    """获取 API 请求头"""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Radar-Bot"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers

def fetch_trending_repos(language: str = "python", since: str = "daily", count: int = 15) -> List[Dict]:
    """
    获取 GitHub 趋势项目
    由于 GitHub API 没有直接的 trending endpoint，使用 search API 模拟
    """
    # 获取最近一周创建的项目，按 stars 排序
    one_week_ago = (datetime.now().timestamp() - 7 * 24 * 3600)
    date_str = datetime.fromtimestamp(one_week_ago).strftime("%Y-%m-%d")
    
    # 构建搜索查询
    query = f"language:{language} created:>{date_str}"
    url = f"{GITHUB_API_BASE}/search/repositories?q={urllib.parse.quote(query)}&sort=stars&order=desc&per_page={count}"
    
    try:
        req = urllib.request.Request(url, headers=get_headers())
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get("items", [])
    except Exception as e:
        print(f"⚠️ 获取趋势项目失败: {e}")
        return []

def fetch_repo_readme(owner: str, repo: str) -> str:
    """获取仓库 README 内容"""
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/readme"
    
    try:
        req = urllib.request.Request(url, headers=get_headers())
        with urllib.request.urlopen(req, timeout=30) as response:
            import base64
            data = json.loads(response.read().decode('utf-8'))
            content = data.get("content", "")
            # Base64 解码
            return base64.b64decode(content.replace('\n', '')).decode('utf-8', errors='ignore')[:2000]
    except Exception as e:
        print(f"⚠️ 获取 README 失败 {owner}/{repo}: {e}")
        return ""

def generate_detailed_description(repo_data: Dict, readme: str) -> tuple:
    """生成详细的项目描述和通俗比喻"""
    name = repo_data.get("name", "")
    description = repo_data.get("description", "") or ""
    full_name = repo_data.get("full_name", "")
    
    # 根据项目类型生成描述
    desc_lower = description.lower()
    name_lower = name.lower()
    
    # 识别项目类型
    is_ai = any(kw in desc_lower or kw in name_lower for kw in ["ai", "llm", "gpt", "claude", "agent", "model", "neural", "machine learning"])
    is_automation = any(kw in desc_lower for kw in ["auto", "bot", "crawl", "scrape", "schedule", "cron"])
    is_cli = any(kw in desc_lower for kw in ["cli", "command", "terminal", "shell", "tool"])
    is_web = any(kw in desc_lower for kw in ["web", "flask", "django", "fastapi", "server", "api"])
    is_data = any(kw in desc_lower for kw in ["data", "pandas", "numpy", "analysis", "chart", "visual"])
    
    # 生成通俗描述（详细版）
    if is_ai:
        detailed_desc = f"这是一个 AI 相关的开源项目。简单来说，它{description or '利用人工智能技术解决特定问题'}。"
        metaphor = f"💡 它就像你的「智能助手」——{description or '能够理解和处理复杂任务，让繁琐的工作变得简单高效'}。"
    elif is_automation:
        detailed_desc = f"这是一个自动化工具项目。{description or '它能够帮你自动完成重复性工作，节省时间'}。"
        metaphor = f"💡 它就像「自动洗衣机」——{description or '你把任务丢进去，它就自动帮你搞定，不用你盯着'}。"
    elif is_cli:
        detailed_desc = f"这是一个命令行工具。{description or '通过终端命令就能使用的实用工具'}。"
        metaphor = f"💡 它就像「瑞士军刀」——{description or '小巧但功能强大，程序员必备的工具箱'}。"
    elif is_web:
        detailed_desc = f"这是一个 Web 开发相关项目。{description or '用于构建网站或 Web 服务'}。"
        metaphor = f"💡 它就像「乐高积木」——{description or '提供标准化的模块，让你快速搭建自己想要的网站'}。"
    elif is_data:
        detailed_desc = f"这是一个数据处理工具。{description or '帮你分析和可视化数据'}。"
        metaphor = f"💡 它就像「数据翻译官」——{description or '把晦涩难懂的原始数据，转化成一目了然的图表和结论'}。"
    else:
        detailed_desc = f"这是一个 Python 开源项目。{description or '解决特定的开发需求'}。"
        metaphor = f"💡 它就像「万能扳手」——{description or '虽然不是最耀眼的工具，但能帮你解决很多实际问题'}。"
    
    # 添加使用场景
    if is_ai:
        usage = "适合想用 AI 提升效率的开发者，或者想快速搭建智能应用的创业者。"
    elif is_automation:
        usage = "适合想节省时间、让电脑帮你干活的人，特别是需要处理重复性任务的场景。"
    elif is_cli:
        usage = "适合程序员和开发者，喜欢用命令行提高效率的人。"
    elif is_web:
        usage = "适合想快速搭建网站、API 服务的开发者。"
    elif is_data:
        usage = "适合需要处理数据、做数据分析的人，比如运营、产品经理、数据分析师。"
    else:
        usage = "适合有特定需求的开发者，可以根据自己的场景灵活使用。"
    
    detailed_desc += f"\n\n🎯 使用场景：{usage}"
    
    return detailed_desc, metaphor

def analyze_with_ai(repo_data: Dict, readme: str) -> Dict:
    """
    使用 AI 分析项目的 Vibecoding 变现潜力
    返回包含评分和分析结果的字典
    """
    description = repo_data.get("description", "") or ""
    name = repo_data.get("name", "").lower()
    readme_lower = readme.lower()
    
    # 合并所有文本用于分析
    all_text = f"{description} {name} {readme_lower}"
    
    # 赛道关键词定义
    tracks = {
        "宠物": ["pet", "dog", "cat", "animal", "宠物", "狗", "猫"],
        "银发": ["elderly", "senior", "aging", "old", "老人", "养老", "银发"],
        "玄学": ["mystic", "tarot", "astrology", "fortune", "玄学", "塔罗", "占星"],
        "金融": ["finance", "trading", "crypto", "stock", "investment", "金融", "交易", "理财"],
        "教育": ["education", "learning", "course", "study", "教育", "学习", "课程"]
    }
    
    # 计算赛道匹配
    matched_tracks = []
    for track_name, keywords in tracks.items():
        if any(kw in all_text for kw in keywords):
            matched_tracks.append(track_name)
    
    # Track Fit 评分：1个赛道=1分，2个及以上=2分
    track_fit = min(len(matched_tracks), 2)
    
    # 其他维度评分
    desc_lower = description.lower()
    
    # Vibecoding Ease (1-3)
    if any(kw in desc_lower for kw in ["simple", "easy", "lightweight"]):
        vibecoding_ease = 3
    elif any(kw in desc_lower for kw in ["framework", "sdk"]):
        vibecoding_ease = 1
    else:
        vibecoding_ease = 2
    
    # Logic Moat (0-2)
    if any(kw in desc_lower for kw in ["algorithm", "model", "unique"]):
        logic_moat = 2
    elif "api" in desc_lower:
        logic_moat = 0
    else:
        logic_moat = 1
    
    # Growth Potential (0-2)
    if any(kw in desc_lower for kw in ["automation", "passive income", "赚钱"]):
        growth_potential = 2
    elif any(kw in desc_lower for kw in ["ai", "agent", "llm", "gpt"]):
        growth_potential = 2
    else:
        growth_potential = 1
    
    scores = {
        "vibecoding_ease": vibecoding_ease,
        "logic_moat": logic_moat,
        "track_fit": track_fit,
        "growth_potential": growth_potential
    }
    
    total = sum(scores.values())
    
    # 生成详细描述和比喻
    detailed_desc, metaphor = generate_detailed_description(repo_data, readme)
    
    # 赛道评分理由
    if matched_tracks:
        track_fit_reason = f"命中 {len(matched_tracks)} 个核心赛道：{', '.join(matched_tracks)}"
    else:
        track_fit_reason = "未直接命中宠物/银发/玄学/金融/教育五大变现赛道"
    
    return {
        "description": detailed_desc,
        "metaphor": metaphor,
        "scores": {
            **scores,
            "total": total
        },
        "score_reasons": {
            "vibecoding_ease": "纯提示词/简单逻辑可复刻" if vibecoding_ease == 3 else ("需要一定架构理解" if vibecoding_ease == 2 else "底层系统复杂，难复刻"),
            "logic_moat": "有独特算法或深度业务逻辑" if logic_moat == 2 else ("有一定设计深度" if logic_moat == 1 else "简单 API 串联"),
            "track_fit": track_fit_reason,
            "growth_potential": "热点赛道，易传播变现" if growth_potential == 2 else "有一定传播潜力"
        }
    }

def generate_project_entry(repo: Dict, date_str: str, index: int) -> Dict:
    """生成项目条目"""
    owner = repo.get("owner", {}).get("login", "")
    name = repo.get("name", "")
    
    # 获取 README
    readme = fetch_repo_readme(owner, name)
    
    # AI 分析
    analysis = analyze_with_ai(repo, readme)
    
    return {
        "date": date_str,
        "id": f"{date_str}-{index:03d}",
        "title": f"{owner} / {name}",
        "url": repo.get("html_url", ""),
        "raw_description": repo.get("description", "") or "",
        "description": analysis["description"],
        "metaphor": analysis["metaphor"],
        "scores": analysis["scores"],
        "is_top": analysis["scores"]["total"] >= 8,
        "score_reasons": analysis["score_reasons"],
        "stars": repo.get("stargazers_count", 0),
        "forks": repo.get("forks_count", 0),
        "language": repo.get("language", "")
    }

def load_existing_data(filepath: str) -> List[Dict]:
    """加载现有数据"""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ 加载现有数据失败: {e}")
    return []

def save_data(filepath: str, data: List[Dict]):
    """保存数据到文件"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ 数据已保存到 {filepath}")

def main():
    """主函数"""
    # 获取今天的日期
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"📅 今日日期: {today}")
    
    # 项目目录
    project_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(project_dir, "radar_history.json")
    
    # 加载现有数据
    print("📂 加载现有数据...")
    existing_data = load_existing_data(data_file)
    print(f"   已有 {len(existing_data)} 条记录")
    
    # 检查今天是否已有数据
    today_existing = [p for p in existing_data if p.get("date") == today]
    if today_existing:
        print(f"⚠️ 今天 ({today}) 已有 {len(today_existing)} 条记录，跳过获取")
        return
    
    # 获取趋势项目
    print("🔍 获取 GitHub Python 趋势项目...")
    repos = fetch_trending_repos(language="python", count=15)
    print(f"   获取到 {len(repos)} 个项目")
    
    if not repos:
        print("⚠️ 未获取到项目，退出")
        return
    
    # 生成项目条目
    print("🤖 分析项目 (AI 评分)...")
    new_entries = []
    for i, repo in enumerate(repos, 1):
        print(f"   [{i}/{len(repos)}] {repo.get('full_name', 'Unknown')}...", end=" ")
        try:
            entry = generate_project_entry(repo, today, i)
            new_entries.append(entry)
            print(f"总分 {entry['scores']['total']}")
        except Exception as e:
            print(f"失败: {e}")
    
    # 合并数据
    all_data = existing_data + new_entries
    
    # 保存数据
    print(f"\n💾 保存数据...")
    save_data(data_file, all_data)
    print(f"   今日新增 {len(new_entries)} 个项目")
    print(f"   总计 {len(all_data)} 个项目")
    
    # 生成统计信息
    top_projects = [p for p in new_entries if p.get("is_top")]
    print(f"\n🏆 今日 Top 项目: {len(top_projects)} 个")
    for p in top_projects:
        print(f"   - {p['title']} (总分: {p['scores']['total']})")

if __name__ == "__main__":
    main()
