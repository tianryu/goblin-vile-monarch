shader_type canvas_item;
render_mode unshaded;

// 参考pixelfx的分层火舌、上升余烬与独立灯光思路，连续轮廓替代像素格。
// 时间由游戏传入，暂停和同一时刻重绘都不会推进粒子或业务状态。
uniform float fire_time = 0.0;
uniform float fire_seed = 0.0;
uniform float presence : hint_range(0.0,1.0) = 1.0;
uniform float strength : hint_range(0.0,1.0) = 1.0;
uniform bool campfire = false;
uniform bool low_effects = false;
varying vec4 paint_tint;

void vertex() { paint_tint = COLOR; }

float tongue(vec2 p, float base, float height, float width, float phase) {
    float t=fire_time;
    float h=height*(0.92+0.06*sin(t*5.1+phase)+0.035*sin(t*8.3+phase*2.3));
    float y=clamp(p.y/h,0.0,1.0);
    float lean=(0.10*sin(t*2.1+phase)+0.055*sin(t*4.7+phase))*y*y;
    float wave=0.035*sin(y*8.0-t*5.2+phase)*y;
    float radius=width*pow(max(0.0,1.0-y),0.68)*(0.88+0.12*sin(y*7.0-t*4.3+phase));
    return max(abs(p.x-base-lean-wave)-radius,max(-p.y,p.y-h)*0.65);
}

void fragment() {
    // QuadMesh的V方向与Canvas纹理矩形相反；基部必须落在火把顶端/木柴上。
    vec2 p=vec2((UV.x-0.5)*2.5,UV.y*1.65-0.10);
    float s=fire_seed;
    float d=min(tongue(p,-0.17,0.77,0.27,s+0.7),tongue(p,0.19,0.67,0.25,s+2.4));
    d=min(d,tongue(p,0.0,1.08,0.26,s+4.1));
    float aa=max(fwidth(d),0.002);
    float outer=1.0-smoothstep(-aa,aa,d);
    float middle_d=tongue(p,0.015,0.79,0.255,s+4.1);
    float middle=1.0-smoothstep(-aa,aa,middle_d);
    float heart_d=tongue(p,0.015,0.47,0.16,s+4.1);
    float heart=1.0-smoothstep(-aa,aa,heart_d);
    vec3 paint=mix(vec3(0.77,0.32,0.15),vec3(0.92,0.55,0.23),middle);
    paint=mix(paint,vec3(0.98,0.79,0.43),heart);
    float alpha=outer;
    // 少量余烬沿确定轨迹上升，出生和消散都有渐变，不每帧重新随机。
    int count=campfire?4:2;
    if(low_effects) count=0;
    for(int i=0;i<4;i++) {
        if(i>=count) break;
        float k=float(i);
        float age=fract(fire_time/(1.25+k*0.23)+fract(s*0.317+k*0.371));
        float ex=(fract(s*0.171+k*0.639)-0.5)*0.42+sin(age*4.0+s+k)*age*0.16;
        float ey=0.35+age*1.12;
        float radius=0.019*(1.0-age*0.58);
        float dust=(1.0-smoothstep(radius-aa,radius+aa,length((p-vec2(ex,ey))*vec2(1.0,0.70))));
        dust*=smoothstep(0.0,0.12,age)*(1.0-smoothstep(0.55,1.0,age))*0.75;
        paint=mix(paint,vec3(0.99,0.77,0.39),dust*(1.0-alpha));
        alpha=max(alpha,dust);
    }
    COLOR=vec4(paint,alpha*presence*strength)*paint_tint;
}
