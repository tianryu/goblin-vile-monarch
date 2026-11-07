shader_type canvas_item;
render_mode unshaded;
uniform vec3 ambient_color = vec3(0.73,0.76,0.70);
uniform vec3 directional_color = vec3(0.0);
uniform vec3 directional_vector = vec3(0.0,0.0,1.0);
uniform int torch_count = 0;
// x/y are canvas coordinates, z is radius, w is energy.
uniform vec4 torches[8];
uniform float torch_height = 70.0;
uniform vec3 torch_color = vec3(1.0,0.57,0.22);
varying vec4 vertex_color;
varying vec2 canvas_point;
void vertex() {
    vertex_color=COLOR;
    canvas_point=(MODEL_MATRIX*vec4(VERTEX,0.0,1.0)).xy;
}
void fragment() {
    vec4 raw=texture(TEXTURE,UV);
    vec4 diffuse=raw*vertex_color;
    // 人物CanvasTexture的高光色只作分类标记，不产生镜面反射。
    float actor=step(0.5,texture(SPECULAR_SHININESS_TEXTURE,vec2(0.5)).r);
    float edge_alpha=raw.a;
    float inner_edge=0.0;
    if(actor>0.5) {
        vec2 p=TEXTURE_PIXEL_SIZE*5.0;
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV+vec2(p.x,0)).a);
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV-vec2(p.x,0)).a);
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV+vec2(0,p.y)).a);
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV-vec2(0,p.y)).a);
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV+p*0.707).a);
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV-p*0.707).a);
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV+vec2(p.x,-p.y)*0.707).a);
        edge_alpha=max(edge_alpha,texture(TEXTURE,UV+vec2(-p.x,p.y)*0.707).a);
        // 原片抠图的浅色混合边由既有描边在内部收口，不改动源帧RGB或人物轮廓。
        vec2 q=TEXTURE_PIXEL_SIZE*1.4;
        float inside=min(min(texture(TEXTURE,UV+vec2(q.x,0)).a,texture(TEXTURE,UV-vec2(q.x,0)).a),min(texture(TEXTURE,UV+vec2(0,q.y)).a,texture(TEXTURE,UV-vec2(0,q.y)).a));
        inner_edge=(1.0-inside)*smoothstep(0.35,0.78,min(raw.r,min(raw.g,raw.b)));
        diffuse.a=max(smoothstep(0.03,0.94,raw.a),edge_alpha)*vertex_color.a;
    }
    // Skip empty sprite margins before evaluating nearby lights.
    if(diffuse.a<0.002) discard;
    vec3 normal=NORMAL;
    vec3 illumination=ambient_color+directional_color*max(dot(normal,directional_vector),0.0);
    for(int i=0;i<8;i++) {
        if(i>=torch_count) break;
        vec2 delta=torches[i].xy-canvas_point;
        float distance_squared=dot(delta,delta);
        float radius=torches[i].z;
        if(distance_squared<radius*radius) {
            float falloff=smoothstep(1.0,0.0,sqrt(distance_squared)/radius);
            vec3 direction=normalize(vec3(delta,torch_height));
            illumination+=torch_color*torches[i].w*falloff*max(dot(normal,direction),0.0);
        }
    }
    if(actor>0.5) {
        illumination=clamp(illumination,vec3(0.45,0.50,0.54),vec3(1.15));
        vec3 ink=vec3(0.09,0.12,0.10)*vertex_color.rgb;
        float fill=smoothstep(0.03,0.94,raw.a);
        vec3 paint=mix(raw.rgb*vertex_color.rgb*illumination,ink,inner_edge*0.95);
        COLOR=vec4(mix(ink,paint,fill),diffuse.a);
    } else { COLOR=vec4(diffuse.rgb*illumination,diffuse.a); }
}
