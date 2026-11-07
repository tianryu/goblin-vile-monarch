class_name MonarchSkin
extends RefCounted

var art
func _init(bank):art=bank

func box(asset,margins=Vector2(26,18),padding=Vector2(19,12)):
	var b=StyleBoxTexture.new();b.texture=art.texture(asset)
	b.texture_margin_left=margins.x;b.texture_margin_right=margins.x
	b.texture_margin_top=margins.y;b.texture_margin_bottom=margins.y
	b.content_margin_left=padding.x;b.content_margin_right=padding.x
	b.content_margin_top=padding.y;b.content_margin_bottom=padding.y
	return b

func theme():
	var t=Theme.new();t.default_font=load("res://game/fonts/GoblinHand-game.ttf");t.default_font_size=20
	t.set_color("font_color","Label",Color("414932"))
	t.set_color("font_color","Button",Color("fff0cd"))
	t.set_color("font_hover_color","Button",Color("fff8e5"))
	t.set_color("font_disabled_color","Button",Color("a69e86"))
	for mode in ["normal","hover","focus","pressed","disabled"]:
		var b=box("ui_button",Vector2(18,12),Vector2(12,8))
		b.modulate_color=Color(0.72,0.72,0.68) if mode=="disabled" else (Color(0.8,0.75,0.65) if mode=="pressed" else Color.WHITE)
		t.set_stylebox(mode,"Button",b)
	var panel=box("ui_panel",Vector2(42,42),Vector2(40,24));panel.content_margin_bottom=42
	t.set_stylebox("panel","PanelContainer",panel)
	# The HUD bars are 5-7px high. Large vertical nine-slice margins spill outside them.
	t.set_stylebox("background","ProgressBar",box("ui_bar",Vector2(6,1),Vector2.ZERO))
	t.set_stylebox("fill","ProgressBar",box("ui_bar_fill",Vector2(2,0),Vector2.ZERO))
	# Menus use bitmap frames; the dimmer only attenuates the existing scene.
	t.set_stylebox("scroll","VScrollBar",box("ui_bar",Vector2(10,10),Vector2.ZERO))
	t.set_stylebox("grabber","VScrollBar",box("ui_bar_fill",Vector2(6,6),Vector2.ZERO))
	t.set_stylebox("grabber_highlight","VScrollBar",box("ui_bar_fill",Vector2(6,6),Vector2.ZERO))
	t.set_stylebox("grabber_pressed","VScrollBar",box("ui_bar_fill",Vector2(6,6),Vector2.ZERO))
	return t

func picture(parent,name,rect):
	var p=TextureRect.new();p.texture=art.texture(name);p.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;p.stretch_mode=TextureRect.STRETCH_SCALE
	p.position=rect.position;p.size=rect.size;p.mouse_filter=Control.MOUSE_FILTER_IGNORE
	parent.add_child(p);return p

func control_button(b,asset):
	for mode in ["normal","hover","pressed","focus","disabled"]:
		var s=box(asset,Vector2.ZERO,Vector2.ZERO)
		s.modulate_color=Color(0.74,0.7,0.62) if mode=="pressed" else (Color(0.55,0.57,0.51) if mode=="disabled" else Color.WHITE)
		b.add_theme_stylebox_override(mode,s)
