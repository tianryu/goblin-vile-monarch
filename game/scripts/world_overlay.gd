extends Node2D
var world
func _draw():
	if world!=null:world.draw_overlay(self)
