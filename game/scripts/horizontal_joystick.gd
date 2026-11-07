extends Control

var axis=0.0
var base
var knob
var target_visible=true
var presence=0.0

func set_target_visible(value):target_visible=value
func _process(delta):
	presence=move_toward(presence,1.0 if target_visible else 0.0,delta/(0.18 if target_visible else 0.22))
	self_modulate.a=smoothstep(0,1,presence)

func _draw():
	var center=size/2
	if base:draw_texture_rect(base,Rect2(Vector2.ZERO,size),false)
	if knob:draw_texture_rect(knob,Rect2(center+Vector2(axis*36,0)-Vector2(28,28),Vector2(56,56)),false)

func set_axis(value):
	axis=value
	queue_redraw()
