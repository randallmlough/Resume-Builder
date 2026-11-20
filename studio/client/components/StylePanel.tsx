import type { ResumeConfig } from '@shared/schema';
import { normalizeHex } from '@shared/schema';

interface StylePanelProps {
  config: ResumeConfig;
  onChange: (next: ResumeConfig) => void;
}

const ACCENT_PRESETS = [
  { name: 'Cobalt (Original)', hex: '1f79c7' },
  { name: 'Navy', hex: '1d3557' },
  { name: 'Slate', hex: '334155' },
  { name: 'Forest', hex: '1f6f54' },
  { name: 'Burgundy', hex: '8c2d3b' },
  { name: 'Charcoal', hex: '18181b' },
];

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer select-none">
      <div>
        <div className="text-sm font-medium text-stone-800">{label}</div>
        {description && <div className="text-xs text-stone-500">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onToggle(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-sky-700' : 'bg-stone-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform mt-0.5 ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function StylePanel({ config, onChange }: StylePanelProps) {
  const accentHex = `#${normalizeHex(config.accent_color)}`;
  const mutedHex = `#${normalizeHex(config.muted_color)}`;

  return (
    <div className="p-5 space-y-6 overflow-y-auto h-full">
      {/* Colors */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Colors & Typography</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Mirrors <code className="font-mono text-[11px] bg-stone-100 px-1 rounded">config.yml</code>{' '}
            using bundled Merriweather &amp; Merriweather Sans fonts.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-600">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentHex}
                onChange={(e) =>
                  onChange({ ...config, accent_color: e.target.value.replace(/^#/, '') })
                }
                className="w-9 h-9 rounded-md border border-stone-200 cursor-pointer bg-white p-0.5"
              />
              <input
                type="text"
                value={config.accent_color}
                onChange={(e) =>
                  onChange({ ...config, accent_color: e.target.value.replace(/^#/, '') })
                }
                maxLength={6}
                className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-600">Muted Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={mutedHex}
                onChange={(e) =>
                  onChange({ ...config, muted_color: e.target.value.replace(/^#/, '') })
                }
                className="w-9 h-9 rounded-md border border-stone-200 cursor-pointer bg-white p-0.5"
              />
              <input
                type="text"
                value={config.muted_color}
                onChange={(e) =>
                  onChange({ ...config, muted_color: e.target.value.replace(/^#/, '') })
                }
                maxLength={6}
                className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => onChange({ ...config, accent_color: preset.hex })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                config.accent_color.toLowerCase() === preset.hex
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/15"
                style={{ backgroundColor: `#${preset.hex}` }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Section Visibility */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-900 mb-1">Visible Sections</h3>
        <div className="divide-y divide-stone-100">
          <ToggleRow
            label="Overview / Summary"
            checked={!config.summary.hide}
            onToggle={(v) => onChange({ ...config, summary: { hide: !v } })}
          />
          <ToggleRow
            label="Experience"
            checked={!config.experience.hide}
            onToggle={(v) =>
              onChange({ ...config, experience: { ...config.experience, hide: !v } })
            }
          />
          <ToggleRow
            label="Projects"
            checked={!config.projects.hide}
            onToggle={(v) => onChange({ ...config, projects: { hide: !v } })}
          />
          <ToggleRow
            label="Technical Skills"
            checked={!config.skills.hide}
            onToggle={(v) => onChange({ ...config, skills: { hide: !v } })}
          />
          <ToggleRow
            label="Education"
            checked={!config.education.hide}
            onToggle={(v) => onChange({ ...config, education: { hide: !v } })}
          />
          <ToggleRow
            label="Page Marker Footer (Pages 2+)"
            description="Displays “Name | Page” centered at the bottom of pages 2+"
            checked={!config.page_marker.hide}
            onToggle={(v) => onChange({ ...config, page_marker: { hide: !v } })}
          />
        </div>
      </div>

      {/* Experience Field Toggles */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-900 mb-1">Experience Details</h3>
        <div className="divide-y divide-stone-100">
          <ToggleRow
            label="Company Overview"
            description="Short muted tagline beneath the company name"
            checked={!config.experience.hide_overview}
            onToggle={(v) =>
              onChange({ ...config, experience: { ...config.experience, hide_overview: !v } })
            }
          />
          <ToggleRow
            label="Company Location"
            description="Displays location next to company name (e.g., Remote)"
            checked={!config.experience.hide_location}
            onToggle={(v) =>
              onChange({ ...config, experience: { ...config.experience, hide_location: !v } })
            }
          />
          <ToggleRow
            label="Company-Level Dates"
            description="Shows overall company tenure on the right of the company row"
            checked={!config.experience.hide_date}
            onToggle={(v) =>
              onChange({ ...config, experience: { ...config.experience, hide_date: !v } })
            }
          />
          <ToggleRow
            label="Technologies Footnote"
            description="Shows italicized technologies list beneath each company"
            checked={!config.experience.hide_technologies}
            onToggle={(v) =>
              onChange({
                ...config,
                experience: { ...config.experience, hide_technologies: !v },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
