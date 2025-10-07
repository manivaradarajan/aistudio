"""
Webpage content extraction and conversion to Markdown
"""
import re
import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md


class WebpageExtractor:
    """Handles webpage content extraction and cleaning"""

    @staticmethod
    def get_webpage_content(url: str) -> str:
        """
        Fetches a webpage and returns clean, Markdown-formatted content.

        Args:
            url: The URL of the webpage to fetch

        Returns:
            Clean Markdown string of the main content

        Raises:
            Exception: If the request fails or content cannot be extracted
        """
        # Fetch HTML with realistic User-Agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                         '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
        except requests.RequestException as e:
            raise Exception(f"Failed to fetch URL {url}: {str(e)}")

        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')

        # Find main content using heuristics
        content_html = WebpageExtractor._find_main_content(soup)

        # Deep clean the content
        WebpageExtractor._deep_clean(content_html)

        # Convert to Markdown
        markdown_text = md(str(content_html), heading_style="ATX")

        # Clean up excessive blank lines
        markdown_text = WebpageExtractor._cleanup_whitespace(markdown_text)

        return markdown_text

    @staticmethod
    def _find_main_content(soup: BeautifulSoup):
        """
        Find the main content block using semantic HTML tags and common patterns.

        Priority order:
        1. <article> tag
        2. <main> tag
        3. <div> with id or class "content"
        4. <div> with id or class "main"
        5. Fall back to <body>
        """
        # Try <article> tag
        article = soup.find('article')
        if article:
            return article

        # Try <main> tag
        main = soup.find('main')
        if main:
            return main

        # Try div with id or class "content"
        content_div = soup.find('div', {'id': 'content'}) or \
                     soup.find('div', {'class': 'content'})
        if content_div:
            return content_div

        # Try div with id or class "main"
        main_div = soup.find('div', {'id': 'main'}) or \
                   soup.find('div', {'class': 'main'})
        if main_div:
            return main_div

        # Fall back to body
        body = soup.find('body')
        if body:
            return body

        # Last resort: return the entire soup
        return soup

    @staticmethod
    def _deep_clean(content_html):
        """
        Remove unwanted elements from the content.

        Removes:
        - <script> tags
        - <style> tags
        - <nav> tags
        - <header> tags
        - <footer> tags
        - Elements with role="navigation" or role="banner"
        - Advertisement elements
        """
        # Remove script and style tags
        for tag in content_html.find_all(['script', 'style']):
            tag.decompose()

        # Remove navigation and structural elements
        for tag in content_html.find_all(['nav', 'header', 'footer']):
            tag.decompose()

        # Remove elements with navigation/banner roles
        for tag in content_html.find_all(attrs={'role': ['navigation', 'banner']}):
            tag.decompose()

        # Remove advertisement elements (check class and id attributes)
        # Build list first to avoid modifying while iterating
        tags_to_remove = []
        for tag in content_html.find_all(True):
            if not tag or not hasattr(tag, 'get'):
                continue

            # Check class attribute
            tag_class = tag.get('class')
            if tag_class:
                class_str = ' '.join(tag_class).lower()
                if any(ad_keyword in class_str for ad_keyword in ['ad', 'advertisement', 'promo', 'sponsor']):
                    tags_to_remove.append(tag)
                    continue

            # Check id attribute
            tag_id = tag.get('id')
            if tag_id:
                id_str = tag_id.lower()
                if any(ad_keyword in id_str for ad_keyword in ['ad', 'advertisement', 'promo', 'sponsor']):
                    tags_to_remove.append(tag)

        # Remove all marked tags
        for tag in tags_to_remove:
            tag.decompose()

    @staticmethod
    def _cleanup_whitespace(text: str) -> str:
        """
        Clean up excessive blank lines in Markdown text.
        Replace 3+ newlines with just 2.
        """
        # Replace 3 or more newlines with exactly 2
        cleaned = re.sub(r'\n{3,}', '\n\n', text)

        # Trim leading/trailing whitespace
        cleaned = cleaned.strip()

        return cleaned
