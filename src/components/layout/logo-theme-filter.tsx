export function LogoThemeFilter() {
  return (
    <svg className="logo-theme-filter" aria-hidden="true" focusable="false">
      <defs>
        <filter id="logo-dark-colors" colorInterpolationFilters="sRGB">
          {/* Swap navy (#000080) and white while preserving the PNG's transparency. */}
          <feColorMatrix
            type="matrix"
            values="-1 0 0 0 1
                    0 -1 0 0 1
                    0 0 -1 0 1.5019608
                    0 0 0 1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
