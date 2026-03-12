#!/usr/bin/env python3
"""
GitHub AI 雷达 - 原始榜单获取
获取当天 GitHub Python 趋势项目，保存原始数据（不打分）
"""

import json
import os
import urllib.request
from datetime import datetime
from typing import List, Dict

GITHUB_API_BASE = "https://api.github.com"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

def get_headers():
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Radar-Bot"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers

def fetch_trending_repos(language: str = "python", count: int = 30) -> List[Dict]:
    """获取 GitHub 趋势项目（原始数据）"""
    # 获取最近一周创建的项目
    one_week_ago = (datetime.now().timestamp() - 7 * 24 * 3600)
    date_str = datetime.fromtimestamp(one_week_ago).strftime("%Y-%m-%d")
    
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

def fetch_repo_topics(owner: str, repo: str) -> List[str]:
    """获取仓库 topics"""
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/topics"
    try:
        req = urllib.request.Request(url, headers={**get_headers(), "Accept": "application/vnd.github.v3+json"})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get("names", [])
    except:
        return []

def generate_chinese_summary(title: str, description: str, topics: list) -> str:
    """生成中文简介"""
    # 根据关键词生成简单总结
    desc_lower = (description or "").lower()
    name_lower = title.lower()
    
    # 判断项目类型
    if any(kw in desc_lower or kw in name_lower for kw in ["ai", "llm", "gpt", "claude", "agent", "machine learning", "deep learning"]):
        category = "AI/机器学习"
    elif any(kw in desc_lower for kw in ["web", "flask", "django", "fastapi", "server"]):
        category = "Web开发"
    elif any(kw in desc_lower for kw in ["data", "pandas", "numpy", "analysis", "visualization"]):
        category = "数据分析"
    elif any(kw in desc_lower for kw in ["automation", "bot", "scraping", "crawler"]):
        category = "自动化工具"
    elif any(kw in desc_lower for kw in ["cli", "command", "terminal", "tool"]):
        category = "命令行工具"
    elif any(kw in desc_lower for kw in ["game", "gaming"]):
        category = "游戏开发"
    else:
        category = "开发工具"
    
    # 提取核心功能
    if "framework" in desc_lower:
        function = "提供开发框架"
    elif "library" in desc_lower or "package" in desc_lower:
        function = "提供功能库"
    elif "tool" in desc_lower or "utility" in desc_lower:
        function = "提供实用工具"
    elif "platform" in desc_lower:
        function = "提供平台服务"
    else:
        function = "解决特定场景需求"
    
    # 生成简介
    summary = f"【{category}】{function}"
    
    if topics:
        summary += f"，主要涉及 {', '.join(topics[:3])} 等技术"
    
    return summary

def main():
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"📅 今日日期: {today}")
    
    project_dir = os.path.dirname(os.path.abspath(__file__))
    raw_data_file = os.path.join(project_dir, "raw_trending.json")
    
    print("🔍 获取 GitHub Python 趋势项目（原始数据）...")
    repos = fetch_trending_repos(count=30)
    print(f"   获取到 {len(repos)} 个项目")
    
    if not repos:
        print("⚠️ 未获取到项目")
        return
    
    # 构建原始榜单数据
    raw_entries = []
    for i, repo in enumerate(repos, 1):
        owner = repo.get("owner", {}).get("login", "")
        name = repo.get("name", "")
        
        print(f"   [{i}/{len(repos)}] {owner}/{name}...", end=" ")
        
        # 获取 topics
        topics = fetch_repo_topics(owner, name)
        
        # 生成中文简介
        raw_desc = repo.get("description", "") or "暂无描述"
        chinese_summary = generate_chinese_summary(name, raw_desc, topics)
        
        entry = {
            "rank": i,
            "date": today,
            "title": f"{owner} / {name}",
            "url": repo.get("html_url", ""),
            "description": raw_desc,
            "chinese_summary": chinese_summary,
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "language": repo.get("language", ""),
            "topics": topics,
            "created_at": repo.get("created_at", ""),
            "updated_at": repo.get("updated_at", ""),
            "homepage": repo.get("homepage", "")
        }
        raw_entries.append(entry)
        print(f"⭐ {entry['stars']}")
    
    # 保存原始数据
    with open(raw_data_file, 'w', encoding='utf-8') as f:
        json.dump({
            "date": today,
            "total": len(raw_entries),
            "projects": raw_entries
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 原始榜单已保存到 {raw_data_file}")
    print(f"   共 {len(raw_entries)} 个项目")
    
    # 显示前5名
    print(f"\n🏆 今日 Top 5:")
    for p in raw_entries[:5]:
        print(f"   {p['rank']}. {p['title']} ⭐ {p['stars']}")
        print(f"      {p['chinese_summary']}")

if __name__ == "__main__":
    main()
