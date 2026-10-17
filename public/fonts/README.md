# Mark Pro font assets

The site uses the supplied Mark Pro files as its primary typeface, paired with Anton for display headings. Manrope remains available as a fallback.

Add your webfont files, licensed for this website, in this directory with these names:

- `MarkPro-Regular.woff2` (or `MarkPro.woff2`) — required, weight 400.
- `MarkPro-Medium.woff2` — recommended, weight 500.
- `MarkPro-Bold.woff2` — recommended, weight 700.

The same names with `.woff`, `.ttf` or `.otf` extensions are also supported; the supplied regular file is `MarkPro.otf`. The loader also supports Hairline (250), Thin (275), ExtraLight (300), Light (350), Book (450), Heavy (800), and Black (900), using the supplied files' weight metadata. Matching italic files such as `MarkPro-Italic.otf` and `MarkPro-BoldItalic.otf` are included automatically. If multiple formats are present, WOFF2 is preferred. Use the regular width of the family. Font files are not downloaded from third-party font mirrors.

Restart `npm run dev` or run `npm run build` after adding the files. The prepare-fonts script runs automatically and writes local @font-face declarations only for supplied files, so missing fonts do not generate broken network requests. A lone medium/bold file does not activate the family until Regular is available.

Font family reference: https://www.myfonts.com/collections/mark-font-fontfont/
