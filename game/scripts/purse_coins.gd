extends RefCounted
# 纯视觉硬币：数量只读自钱袋，不参与扣费，也不消耗玩法随机源。
var coins=[]
var serial=0
func update(delta,amount):
	amount=maxi(0,int(amount))
	while coins.size()>amount:coins.pop_back()
	while coins.size()<amount:
		serial+=1;var i=coins.size();var random=RandomNumberGenerator.new();random.seed=serial*7919+317
		coins.append({"id":serial,"age":-random.randf_range(0,0.16),"x":19+fposmod(i*0.618034,1.0)*53+random.randf_range(-3.5,3.5),"y":minf(71,70-floor(i/10.0)*6+random.randf_range(-3.5,3.5)),"start":random.randf_range(32,60),"angle":random.randf_range(-0.95,0.95)})
	for c in coins:c.age+=minf(delta,0.1)
func pose(c):
	var t=clampf(c.age/0.46,0,1);var bounce=abs(sin(maxf(0,c.age-0.46)*21))*exp(-maxf(0,c.age-0.46)*13)*6 if c.age>0.46 else 0.0
	return Vector2(lerpf(c.start,c.x,smoothstep(0,1,t)),lerpf(-5,c.y,t*t)-bounce)
