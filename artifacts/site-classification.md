# FlowForge site classification

The app HTML now includes a descriptive title, description, social metadata and Schema.org WebApplication JSON-LD. A static public page at `/flowforge/about.html` describes actual application capabilities without requiring JavaScript or authentication. Login links to that page.

Deploy the frontend build to make these additions available to public crawlers. Submit both `https://gkjtt.co.za/` and `https://gkjtt.co.za/flowforge/about.html` in the FortiGuard review request. The blocked screenshot concerns the domain root: this repository deploys under `/flowforge/` and does not manage the root homepage. The root homepage should accurately describe its own business and link to FlowForge where appropriate.

Fortinet controls classification; these additions do not guarantee recategorisation or override a network policy. No Fortinet-specific classification tag was identified in the official guidance reviewed. No review has been submitted automatically. No robots policy or authentication settings were changed.

Official guidance: https://docs.fortinet.com/document/fortiproxy/7.6.6/administration-guide/636363/url-lookup
