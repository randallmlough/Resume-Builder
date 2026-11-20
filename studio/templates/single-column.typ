// Single-column Resume Template — Typst port of templates/single-column.tmpl
// Tuned to match dist/resume.pdf (LuaLaTeX + Merriweather / Merriweather Sans)

#let data = json("/resume.json")
#let cfg = json("/config.json")

#let clean-hex(h, fallback) = {
  let s = str(h).trim()
  if s.starts-with("#") { s = s.slice(1) }
  if s.len() == 6 { "#" + s } else { fallback }
}

#let accent = rgb(clean-hex(cfg.at("accent_color", default: "1f79c7"), "#1f79c7"))
#let muted = rgb(clean-hex(cfg.at("muted_color", default: "5a5a5a"), "#5a5a5a"))

#let body-font = ("Merriweather Sans", "Liberation Sans", "DejaVu Sans")
#let heading-font = ("Merriweather", "Liberation Serif", "DejaVu Serif")

#let page-marker-hide = cfg.at("page_marker", default: (:)).at("hide", default: false)
#let summary-hide = cfg.at("summary", default: (:)).at("hide", default: false)
#let skills-hide = cfg.at("skills", default: (:)).at("hide", default: false)
#let projects-hide = cfg.at("projects", default: (:)).at("hide", default: false)
#let education-hide = cfg.at("education", default: (:)).at("hide", default: false)

#let exp-cfg = cfg.at("experience", default: (:))
#let exp-hide = exp-cfg.at("hide", default: false)
#let exp-hide-overview = exp-cfg.at("hide_overview", default: false)
#let exp-hide-location = exp-cfg.at("hide_location", default: false)
#let exp-hide-date = exp-cfg.at("hide_date", default: true)
#let exp-hide-tech = exp-cfg.at("hide_technologies", default: true)

#let ensure-url(u) = {
  let s = str(u).trim()
  if s.starts-with("http://") or s.starts-with("https://") { s } else { "https://www." + s }
}

#let render-multiline(s) = {
  let parts = str(s).split("\n")
  parts.join(linebreak())
}

#set document(
  title: data.at("name", default: "Resume") + " — Resume",
  author: data.at("name", default: ""),
)

#set page(
  paper: "us-letter",
  margin: (left: 0.52in, right: 0.52in, top: 0.54in, bottom: 0.56in),
  footer-descent: 0.16in,
  footer: context {
    if not page-marker-hide and counter(page).get().first() > 1 {
      align(center, text(size: 8.8pt, fill: muted)[
        #data.at("name", default: "")#h(0.5em)|#h(0.5em)#counter(page).display()
      ])
    }
  },
)

#set text(
  font: body-font,
  size: 9.8pt,
  fill: rgb("#111111"),
  lang: "en",
  hyphenate: false,
)

#set par(
  justify: false,
  leading: 0.54em,
  spacing: 0.6em,
)

// Section heading with Merriweather small-caps + full-width rule directly underneath
#let resume-section(title) = {
  v(13pt, weak: true)
  block(sticky: true, below: 6.5pt)[
    #stack(
      dir: ttb,
      spacing: 2.5pt,
      text(font: heading-font, size: 11.8pt, weight: "regular", fill: black)[#smallcaps(title)],
      line(length: 100%, stroke: 0.55pt + black),
    )
  ]
}

// Custom bullet list matching LaTeX \resumeItem
#let bullet-list(items) = {
  if items.len() > 0 {
    v(3pt)
    pad(left: 1.55em)[
      #for item in items [
        #grid(
          columns: (0.95em, 1fr),
          column-gutter: 0pt,
          align: (left + top, left + top),
          [#move(dy: 0.5pt, text(size: 7pt)[•])],
          [#text(size: 9.6pt)[#render-multiline(item)]],
        )
        #v(2.6pt, weak: true)
      ]
    ]
  }
}

// ==========================================
// HEADER
// ==========================================
#let contact = data.at("contact", default: (:))
#let contact-items = ()
#if contact.at("phone", default: "") != "" {
  let phone = contact.phone
  contact-items.push(link("tel:" + phone)[#phone])
}
#if contact.at("email", default: "") != "" {
  let email = contact.email
  contact-items.push(link("mailto:" + email)[#email])
}
#if contact.at("linkedin", default: "") != "" {
  contact-items.push(link(ensure-url(contact.linkedin))[LinkedIn])
}
#if contact.at("github", default: "") != "" {
  contact-items.push(link(ensure-url(contact.github))[GitHub])
}

#align(center)[
  #stack(
    dir: ttb,
    spacing: 4pt,
    text(font: heading-font, size: 24.5pt, weight: "bold", fill: accent)[#smallcaps(data.at("name", default: ""))],
    text(size: 9.6pt)[#contact-items.join([#h(0.35em)|#h(0.35em)])],
  )
]
#v(6pt)

// ==========================================
// OVERVIEW
// ==========================================
#let summary = data.at("summary", default: "")
#if not summary-hide and summary != "" [
  #resume-section("Overview")
  #text(size: 9.7pt)[#render-multiline(summary)]
  #v(3pt)
]

// ==========================================
// EXPERIENCE
// ==========================================
#let visible-exp = data.at("experience", default: ()).filter(j => not j.at("hide", default: false))
#if not exp-hide and visible-exp.len() > 0 [
  #resume-section("Experience")
  #pad(left: 0.08in)[
    #for (j-idx, job) in visible-exp.enumerate() {
      let loc = job.at("location", default: "")
      let start-d = job.at("startDate", default: "")
      let end-d = job.at("endDate", default: "")
      let overview = job.at("overview", default: "")
      let positions = job.at("positions", default: ())
      let techs = job.at("technologies", default: ())

      if j-idx > 0 { v(10pt) }

      // Helper to render one position
      let render-position(pos) = {
        let p-start = pos.at("startDate", default: "")
        let p-end = pos.at("endDate", default: "")
        let p-dates = if p-start != "" and p-end != "" { p-start + " – " + p-end } else { p-start + p-end }
        let resps = pos.at("responsibilities", default: ())

        block(sticky: true, below: 2pt)[
          #grid(
            columns: (1fr, auto),
            align: (left + bottom, right + bottom),
            [#text(size: 9.7pt, weight: "bold", style: "italic")[#pos.at("title", default: "")]],
            [#text(size: 9.7pt, style: "italic")[#p-dates]],
          )
        ]
        bullet-list(resps)
      }

      let company-header = [
        #grid(
          columns: (1fr, auto),
          align: (left + bottom, right + bottom),
          [
            #text(size: 12pt, weight: "bold", fill: accent)[#job.at("company", default: "")]
            #if not exp-hide-location and loc != "" [
              #text(size: 8.6pt, fill: muted)[#h(0.45em)|#h(0.45em)#loc]
            ]
          ],
          [
            #if not exp-hide-date and start-d != "" [
              #text(size: 8.6pt, fill: muted)[#start-d – #end-d]
            ]
          ],
        )
        #if not exp-hide-overview and overview != "" [
          #v(1pt)
          #text(size: 8.6pt, fill: muted)[#render-multiline(overview)]
        ]
      ]

      // Mirrors \Needspace{10\baselineskip}: keep company header + first role together
      // so a company never orphans near the bottom of a page.
      if positions.len() > 0 {
        let first-pos = positions.at(0)
        let first-resps = first-pos.at("responsibilities", default: ())
        let keep-all-first = first-resps.len() <= 5
        if keep-all-first {
          block(breakable: false)[
            #company-header
            #v(4.5pt)
            #render-position(first-pos)
          ]
        } else {
          block(sticky: true, below: 4.5pt)[#company-header]
          render-position(first-pos)
        }
        for pos in positions.slice(1) {
          v(8pt)
          let resps = pos.at("responsibilities", default: ())
          if resps.len() <= 4 {
            block(breakable: false)[#render-position(pos)]
          } else {
            render-position(pos)
          }
        }
      } else {
        block(breakable: false)[#company-header]
      }

      if not exp-hide-tech and techs.len() > 0 {
        v(3pt)
        text(size: 8.6pt, style: "italic", fill: muted)[Technologies: #techs.join(", ")]
      }
    }
  ]
  #v(3pt)
]

// ==========================================
// PROJECTS
// ==========================================
#let visible-projects = data.at("projects", default: ()).filter(p => not p.at("hide", default: false))
#if not projects-hide and visible-projects.len() > 0 [
  #resume-section("Projects")
  #pad(left: 0.08in)[
    #for (p-idx, proj) in visible-projects.enumerate() {
      if p-idx > 0 { v(10pt) }
      let techs = proj.at("technologies", default: ())
      let web-url = proj.at("url", default: "")
      let gh-url = proj.at("github", default: "")
      let links = ()
      if web-url != "" { links.push(link(web-url)[#underline(offset: 1.5pt)[Website]]) }
      if gh-url != "" { links.push(link(gh-url)[#underline(offset: 1.5pt)[GitHub]]) }

      block(sticky: true, below: 2pt)[
        #grid(
          columns: (1fr, auto),
          column-gutter: 8pt,
          align: (left + bottom, right + bottom),
          [
            #text(size: 9.7pt, weight: "bold")[#proj.at("name", default: "")]
            #if techs.len() > 0 [
              #h(0.35em)|#h(0.35em)#text(size: 9.7pt, style: "italic")[#techs.join(", ")]
            ]
          ],
          [#text(size: 9.7pt)[#links.join([#h(0.35em)|#h(0.35em)])]],
        )
      ]
      bullet-list(proj.at("items", default: ()))
    }
  ]
  #v(3pt)
]

// ==========================================
// TECHNICAL SKILLS
// ==========================================
#let raw-skills = data.at("skills", default: ())
#if not skills-hide and raw-skills.len() > 0 [
  #resume-section("Technical Skills")
  #let categories = ()
  #for sk in raw-skills {
    let cat-name = if type(sk) == dictionary { sk.at("category", default: "Other") } else { "Other" }
    let sk-name = if type(sk) == dictionary { sk.at("name", default: "") } else if type(sk) == array { sk.at(0, default: "") } else { str(sk) }
    if sk-name != "" {
      let idx = categories.position(c => c.name == cat-name)
      if idx == none {
        categories.push((name: cat-name, values: (sk-name,)))
      } else {
        categories.at(idx).values.push(sk-name)
      }
    }
  }
  #pad(left: 0.14in)[
    #grid(
      columns: (auto, 1fr),
      column-gutter: 1em,
      row-gutter: 5.5pt,
      align: (left + top, right + top),
      ..categories.map(c => (
        text(size: 9.7pt, weight: "bold")[#c.name:],
        text(size: 9.7pt)[#c.values.join(", ")],
      )).flatten()
    )
  ]
  #v(3pt)
]

// ==========================================
// EDUCATION
// ==========================================
#let visible-edu = data.at("education", default: ()).filter(e => not e.at("hide", default: false))
#if not education-hide and visible-edu.len() > 0 [
  #resume-section("Education")
  #pad(left: 0.08in)[
    #for (e-idx, edu) in visible-edu.enumerate() {
      if e-idx > 0 { v(7pt) }
      let inst = edu.at("institution", default: "")
      let college = edu.at("college", default: "")
      let title-text = if college != "" { inst + ", " + college } else { inst }
      let start-d = edu.at("startDate", default: "")
      let end-d = edu.at("endDate", default: "")
      let dates = if start-d != "" and end-d != "" { start-d + " – " + end-d } else { start-d + end-d }
      let deg = edu.at("degree", default: "")
      let gpa = edu.at("gpa", default: "")
      let deg-text = if gpa != "" { deg + "; GPA: " + gpa } else { deg }

      block(breakable: false)[
        #grid(
          columns: (1fr, auto),
          align: (left + bottom, right + bottom),
          [#text(size: 10.2pt, weight: "bold")[#title-text]],
          [#text(size: 10pt)[#dates]],
        )
        #v(1.5pt)
        #text(size: 9.7pt, style: "italic")[#deg-text]
      ]
    }
  ]
]
