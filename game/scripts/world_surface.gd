extends Node2D
var world
var actors=false
func _draw():
	if world!=null:world.draw_surface(self,actors)
