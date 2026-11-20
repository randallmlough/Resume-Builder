// Cover Letter Template — Typst port of templates/cover-letter.tmpl
// Reads /resume.json, /config.json, and includes /cover-letter-body.typ from the virtual filesystem.

#let data = json("/resume.json")
#let cfg = json("/config.json")

#let clean-hex(h, fallback) = {
  let s = str(h).trim()
  if s.starts-with("#") { s = s.slice(1) }
  if s.len() == 6 { "#" + s } else { fallback }
}

#let accent = rgb(clean-hex(cfg.at("accent_color", default: "1f79c7"), "#1f79c7"))
#let body-font = ("Merriweather Sans", "Liberation Sans", "DejaVu Sans")
#let serif-font = ("Merriweather", "Liberation Serif", "DejaVu Serif")

#let ensure-url(u) = {
  let s = str(u).trim()
  if s.starts-with("http://") or s.starts-with("https://") { s } else { "https://www." + s }
}

#set document(
  title: data.at("name", default: "Cover Letter") + " — Cover Letter",
  author: data.at("name", default: ""),
)

#set page(
  paper: "us-letter",
  margin: (left: 0.65in, right: 0.65in, top: 0.55in, bottom: 0.65in),
)

#set text(
  font: body-font,
  size: 10pt,
  fill: rgb("#111111"),
  lang: "en",
)

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
  contact-items.push(link(ensure-url(contact.linkedin))[#contact.linkedin])
}
#if contact.at("github", default: "") != "" {
  contact-items.push(link(ensure-url(contact.github))[#contact.github])
}

#align(center)[
  #stack(
    dir: ttb,
    spacing: 4pt,
    text(font: serif-font, size: 24.5pt, weight: "bold", fill: accent)[#smallcaps(data.at("name", default: ""))],
    text(size: 9.2pt)[#contact-items.join([#h(0.35em)|#h(0.35em)])],
  )
]

#v(18pt)

// ==========================================
// BODY (Merriweather serif, matching cover-letter.tmpl)
// ==========================================
#set text(font: serif-font, size: 10.6pt, fill: rgb("#1a1a1a"))
#set par(first-line-indent: 0pt, spacing: 12pt, leading: 0.72em, justify: false)
#set list(spacing: 6pt, indent: 1em)
#set enum(spacing: 6pt, indent: 1em)

#include "/cover-letter-body.typ"
