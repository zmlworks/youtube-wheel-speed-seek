import math
def glyph(fg, knock, ang=-28, ribs="lower", halo=None, cx=57, cy=73, r=37, sw=15):
    a0=math.radians(-28)  # ring end at ~2 o'clock
    x0,y0=cx+r*math.cos(a0),cy+r*math.sin(a0)
    x1,y1=cx,cy-r          # ring end at 12 o'clock
    ring=f'<path d="M{x0:.1f} {y0:.1f} A{r} {r} 0 1 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{fg}" stroke-width="{sw}" stroke-linecap="round"/>'
    px,py=cx+22,cy-33
    L,W=54,22
    pill=f'<rect x="{-L/2}" y="{-W/2}" width="{L}" height="{W}" rx="{W/2}"/>'
    if ribs=="lower":
        rl=''.join(f'<path d="M{x} 1 L{x+5} {W/2}"/>' for x in range(-12,20,6))
    else:
        rl=''.join(f'<path d="M{x} {-W/2} L{x} {W/2}"/>' for x in range(-12,20,6))
    g=f'''<g transform="translate({px} {py}) rotate({ang})">
  <clipPath id="pc{ang}">{pill}</clipPath>
  <g stroke="{knock}" stroke-width="6" fill="none">{pill.replace('/>',' fill="none"/>')}</g>
  <g fill="{fg}">{pill}</g>
  <g clip-path="url(#pc{ang})" stroke="{knock}" stroke-width="2.6" stroke-linecap="round">{rl}</g>
</g>'''
    cut=f'<g transform="translate({px} {py}) rotate({ang})"><rect x="{-L/2-4}" y="{-W/2-4}" width="{L+8}" height="{W+8}" rx="{W/2+4}" fill="#000"/></g>'
    mid=f'm{ang}{fg[1:]}'
    ring=f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128"><rect width="128" height="128" fill="#fff"/>{cut}</mask><g mask="url(#{mid})">{ring}</g>'
    g=g.replace(f'<g stroke="{knock}" stroke-width="6" fill="none">','<g stroke="none" fill="none">')
    body=ring+g
    if halo:
        body=f'<g stroke="{halo}" stroke-width="4" fill="{halo}" opacity="1"><path d="M{x0:.1f} {y0:.1f} A{r} {r} 0 1 1 {x1:.1f} {y1:.1f}" fill="none" stroke-width="{sw+5}" stroke-linecap="round"/><g transform="translate({px} {py}) rotate({ang})"><rect x="{-L/2-2.5}" y="{-W/2-2.5}" width="{L+5}" height="{W+5}" rx="{W/2+2.5}" stroke="none"/></g></g>'+body
    return body
def svg(bg, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">{bg}{body}</svg>'
grad='<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset="1" stop-color="#d4145a"/></linearGradient></defs>'
open("A.svg","w").write(svg('<rect x="4" y="4" width="120" height="120" rx="28" fill="#212121"/>', glyph("#fff","#212121")))
open("B.svg","w").write(svg(grad+'<rect x="4" y="4" width="120" height="120" rx="28" fill="url(#g)"/>', glyph("#fff","#e0325a")))
open("C-light.svg","w").write(svg('', glyph("#2b2a33","#f9f9fb",ang=-40,ribs="full",sw=16)))
open("C-dark.svg","w").write(svg('', glyph("#fbfbfe","#2b2a33",ang=-40,ribs="full",sw=16)))
# C: no background, dark glyph with white halo (works on light & dark toolbars), steeper wheel, straight grooves
#open("C.svg","w").write(svg('', glyph("#3d3d48","#ffffff",ang=-40,ribs="full",halo="#ffffff",sw=16)))
