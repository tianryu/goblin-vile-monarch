class_name MonarchSave
extends RefCounted

const KEY="goblin_monarch_godot_v3"
const FILE="user://campaign-v3.json"
var last_error=""
var last_good_payload=""

func write(model):
	var payload=JSON.stringify(model.snapshot())
	if OS.has_feature("web"):
		var backup="localStorage.setItem("+JSON.stringify(KEY+".bak")+","+JSON.stringify(last_good_payload)+");" if last_good_payload!="" and last_good_payload!=payload else ""
		var result=JavaScriptBridge.eval("(()=>{try{"+backup+"localStorage.setItem("+JSON.stringify(KEY)+","+JSON.stringify(payload)+");return 'ok'}catch(e){return String(e)}})()",true)
		last_error="" if result=="ok" else "浏览器未能保存，请检查存储权限"
		if result=="ok":last_good_payload=payload
		return last_error==""
	var file=FileAccess.open(FILE+".tmp",FileAccess.WRITE)
	if file==null:last_error="存档写入失败";return false
	file.store_string(payload);file.close()
	if FileAccess.file_exists(FILE):DirAccess.copy_absolute(FILE,FILE+".bak")
	var error=DirAccess.rename_absolute(FILE+".tmp",FILE)
	last_error="" if error==OK else "存档替换失败"
	return error==OK

func read_into(model):
	if OS.has_feature("web"):
		for suffix in ["",".bak"]:
			var payload=JavaScriptBridge.eval("(()=>{try{return localStorage.getItem("+JSON.stringify(KEY+suffix)+")}catch(e){return null}})()",true)
			if payload is String and model.restore(decode(payload)):
				last_good_payload=payload
				if suffix!="":model.notify("已从备份恢复存档")
				return true
		return false
	for path in [FILE,FILE+".bak"]:
		if FileAccess.file_exists(path) and model.restore(decode(FileAccess.get_file_as_string(path))):return true
	return false

func decode(payload):
	var parser=JSON.new()
	if parser.parse(payload)!=OK:return null
	return parser.data
