<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  exclude-result-prefixes="sm image">
  <xsl:output method="html" doctype-system="about:legacy-compat" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <meta name="robots" content="noindex, follow"/>
        <title>
          <xsl:choose>
            <xsl:when test="sm:sitemapindex">Tulusy XML Sitemap Index</xsl:when>
            <xsl:otherwise>Tulusy XML Sitemap</xsl:otherwise>
          </xsl:choose>
        </title>
        <style>
          :root {
            --bg: #f8fafc;
            --card: #ffffff;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --accent: #2563eb;
            --badge-bg: #f1f5f9;
            --row-hover: #f8fafc;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #090d16;
              --card: #0f172a;
              --text: #f8fafc;
              --muted: #94a3b8;
              --border: #1e293b;
              --accent: #38bdf8;
              --badge-bg: #1e293b;
              --row-hover: #131c31;
            }
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 32px 16px;
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
            line-height: 1.5;
          }
          .wrap { max-width: 1020px; margin: 0 auto; }
          .header {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 18px;
          }
          .title-row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
          .desc { margin: 8px 0 0; font-size: 13px; color: var(--muted); }
          .nav { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; font-weight: 600; }
          .nav a {
            color: var(--accent);
            text-decoration: none;
            padding: 6px 10px;
            border-radius: 8px;
            background: var(--badge-bg);
          }
          .nav a:hover { text-decoration: underline; }
          .panel {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow-x: auto;
          }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th {
            text-align: left;
            padding: 12px 16px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--muted);
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
          }
          td {
            padding: 11px 16px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
          }
          tr:last-child td { border-bottom: none; }
          tbody tr:hover { background: var(--row-hover); }
          .url a {
            color: var(--accent);
            text-decoration: none;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 12.5px;
            word-break: break-all;
          }
          .url a:hover { text-decoration: underline; }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 6px;
            background: var(--badge-bg);
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 12px;
            font-weight: 600;
          }
          .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 12px;
            color: var(--muted);
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="header">
            <div class="title-row">
              <h1>
                <xsl:choose>
                  <xsl:when test="sm:sitemapindex">Tulusy XML Sitemap Index</xsl:when>
                  <xsl:otherwise>Tulusy XML Sitemap</xsl:otherwise>
                </xsl:choose>
              </h1>
              <div class="nav">
                <a href="/">Home</a>
                <a href="/sitemap">HTML Sitemap</a>
                <xsl:if test="sm:urlset">
                  <a href="/sitemap.xml">Sitemap Index</a>
                </xsl:if>
              </div>
            </div>
            <p class="desc">
              <xsl:choose>
                <xsl:when test="sm:sitemapindex">
                  Generated sitemap index containing <strong><xsl:value-of select="count(sm:sitemapindex/sm:sitemap)"/></strong> categorized sub-sitemaps for search engine crawlers.
                </xsl:when>
                <xsl:otherwise>
                  This XML sitemap contains <strong><xsl:value-of select="count(sm:urlset/sm:url)"/></strong> canonical URLs with Git-derived modification timestamps.
                </xsl:otherwise>
              </xsl:choose>
            </p>
          </div>

          <div class="panel">
            <xsl:choose>
              <xsl:when test="sm:sitemapindex">
                <table>
                  <thead>
                    <tr>
                      <th>Sub-Sitemap URL</th>
                      <th>Last Modified (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="sm:sitemapindex/sm:sitemap">
                      <tr>
                        <td class="url">
                          <a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a>
                        </td>
                        <td class="mono"><xsl:value-of select="sm:lastmod"/></td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:when>
              <xsl:otherwise>
                <xsl:variable name="hasImages" select="count(sm:urlset/sm:url/image:image) &gt; 0"/>
                <table>
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Priority</th>
                      <th>Change Freq</th>
                      <xsl:if test="$hasImages">
                        <th>Images</th>
                      </xsl:if>
                      <th>Last Modified (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="sm:urlset/sm:url">
                      <tr>
                        <td class="url">
                          <a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a>
                        </td>
                        <td>
                          <span class="badge"><xsl:value-of select="sm:priority"/></span>
                        </td>
                        <td class="mono"><xsl:value-of select="sm:changefreq"/></td>
                        <xsl:if test="$hasImages">
                          <td class="mono"><xsl:value-of select="count(image:image)"/></td>
                        </xsl:if>
                        <td class="mono"><xsl:value-of select="sm:lastmod"/></td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:otherwise>
            </xsl:choose>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
