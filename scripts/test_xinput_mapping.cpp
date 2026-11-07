#include "../cocos/native/engine/common/Classes/XInputMapping.h"
#include <iostream>

void emit(const char *name, XINPUT_GAMEPAD p) {
    const auto values = monarch::mapXInput(p);
    std::cout << "{\"name\":\"" << name << "\",\"id\":0,\"buttonInfoList\":[";
    bool first = true;
    for (const auto &b : values.buttons) {
        if (!first) std::cout << ',';
        first = false;
        std::cout << "{\"code\":" << b.first << ",\"isPressed\":" << b.second << '}';
    }
    std::cout << "],\"axisInfoList\":["; first = true;
    for (const auto &a : values.axes) {
        if (!first) std::cout << ',';
        first = false;
        std::cout << "{\"code\":" << a.first << ",\"value\":" << a.second << '}';
    }
    std::cout << "]}\n";
}
int main() {
    emit("neutral", {});
    for (const auto &b : {
        std::pair<const char *, WORD>{"A", XINPUT_GAMEPAD_A}, {"B", XINPUT_GAMEPAD_B},
        {"X", XINPUT_GAMEPAD_X}, {"Y", XINPUT_GAMEPAD_Y},
        {"LB", XINPUT_GAMEPAD_LEFT_SHOULDER}, {"Start", XINPUT_GAMEPAD_START},
        {"Back", XINPUT_GAMEPAD_BACK}}) {
        XINPUT_GAMEPAD p{}; p.wButtons = b.second; emit(b.first, p);
    }
    XINPUT_GAMEPAD p{}; p.bRightTrigger = 255; emit("RT", p);
    p = {}; p.sThumbLX = -32768; p.sThumbLY = 32767;
    p.wButtons = XINPUT_GAMEPAD_DPAD_RIGHT | XINPUT_GAMEPAD_DPAD_DOWN; emit("axes", p);
    emit("release", {});
}
