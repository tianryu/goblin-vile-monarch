class_name MonarchAnimationBank
extends RefCounted

# 只管理已验收序列的播放与可见纹理缓存，不修改单位/金币/战斗状态。
const ROOT="res://game/art/animation/"
const KEEP_SECONDS=8.0
const CACHE_BUDGET=48*1024*1024
var clips={}
var pending={}
var cache={}
var clock=0.0
var decoded_bytes=0
var actor_marker
var plain_marker
var flat_normal

func _init():
	var normal=Image.create(1,1,false,Image.FORMAT_RGB8);normal.fill(Color(0.5,0.5,1));flat_normal=ImageTexture.create_from_image(normal)
	var path=ROOT+"manifest.json"
	if FileAccess.file_exists(path):
		var data=JSON.parse_string(FileAccess.get_file_as_string(path))
		if data is Dictionary:clips=data.get("clips",{})

# 仅在线程加载完成后取资源；缺失/加载中继续显示已批准静态图，不阻塞触控。
func update(delta):
	clock+=maxf(0,delta)
	for path in pending.keys():
		var status=ResourceLoader.load_threaded_get_status(path)
		if status==ResourceLoader.THREAD_LOAD_LOADED:
			var texture=ResourceLoader.load_threaded_get(path)
			if texture is Texture2D:
				var cost=texture.get_width()*texture.get_height()*4
				cache[path]={"texture":texture,"used":clock,"bytes":cost};decoded_bytes+=cost
			pending.erase(path)
		elif status in [ResourceLoader.THREAD_LOAD_FAILED,ResourceLoader.THREAD_LOAD_INVALID_RESOURCE]:pending.erase(path)
	for path in cache.keys():
		if clock-float(cache[path].used)>KEEP_SECONDS:
			decoded_bytes-=cache[path].bytes;cache.erase(path)
	if decoded_bytes>CACHE_BUDGET:
		var keys=cache.keys();keys.sort_custom(func(a,b):return cache[a].used<cache[b].used)
		for path in keys:
			if decoded_bytes<=CACHE_BUDGET:break
			# 当前帧正在使用的图集不能被反复驱逐/请求，引发显示闪动。
			if clock-float(cache[path].used)<0.5:continue
			decoded_bytes-=cache[path].bytes;cache.erase(path)

func has_clip(asset,action):return clips.has(asset+"/"+action)

# ResourceLoader owns each threaded request until get is called, even if this bank
# leaves the tree before the next update. Drain only our own requests at teardown.
func shutdown():
	for path in pending.keys():
		var status=ResourceLoader.load_threaded_get_status(path)
		if status in [ResourceLoader.THREAD_LOAD_IN_PROGRESS,ResourceLoader.THREAD_LOAD_LOADED]:
			ResourceLoader.load_threaded_get(path)
	pending.clear();cache.clear();decoded_bytes=0

# 可见兵种提前异步请求攻击图，首次放箭不必先闪一帧带搭弓箭的静态姿势。
# 只预取即将用到的动作，仍由同一缓存和预算回收，不预载全世界动画。
func warm(asset,action):
	var id=asset+"/"+action
	if clips.has(id):_texture(ROOT+clips[id].sheet)

# 标记与中性法线均为技术数据。配对纹理随同图集缓存回收，不形成第二份常驻缓存。
func lit_texture(clip,actor):
	var path=ROOT+clip.sheet
	if not cache.has(path):return null
	var row=cache[path];var id="actor" if actor else "world"
	if not row.has(id):
		var paired=CanvasTexture.new();paired.diffuse_texture=row.texture;paired.normal_texture=flat_normal
		paired.specular_texture=actor_marker if actor else plain_marker;paired.specular_color=Color.WHITE;row[id]=paired
	return row[id]

func atlas_texture(pose):
	var row=cache[ROOT+pose.clip.sheet]
	if not row.has("atlases"):row.atlases={}
	if not row.atlases.has(pose.index):
		var atlas=AtlasTexture.new();atlas.atlas=pose.texture;atlas.region=pose.source;row.atlases[pose.index]=atlas
	return row.atlases[pose.index]

func _texture(path):
	if cache.has(path):cache[path].used=clock;return cache[path].texture
	if not pending.has(path) and ResourceLoader.exists(path):
		if ResourceLoader.load_threaded_request(path)==OK:pending[path]=true
	return null

# 同一动作使用同一固定裁切和锚点，绝不逐帧居中或缩放来掩盖源图漂移。
func pose(asset,action,seconds,phase=0.0):
	var id=asset+"/"+action
	if not clips.has(id):return {}
	var clip=clips[id];var texture=_texture(ROOT+clip.sheet)
	if texture==null:return {}
	var duration=float(clip.duration);var t=fposmod(seconds+phase,duration) if clip.get("loop",true) else clampf(seconds,0,duration-0.00001)
	var index=0;var accumulated=0.0
	for i in range(clip.frames.size()):
		accumulated+=float(clip.frames[i].seconds)
		if t<accumulated:index=i;break
	var f=clip.frames[index]
	return {"id":id,"texture":texture,"source":Rect2(f.x,f.y,clip.width,clip.height),"clip":clip,"index":index}
