#pragma once
#include <windows.h>
#include <Xinput.h>
#include <array>
#include <utility>

namespace monarch {
struct PadValues {
    std::array<std::pair<int, bool>, 10> buttons;
    std::array<std::pair<int, float>, 8> axes;
};

// Cocos 3.8.8's native PAL uses Nintendo names for codes 1..4:
// code 2 is SOUTH (Xbox A), code 1 is EAST (Xbox B).
inline PadValues mapXInput(const XINPUT_GAMEPAD &p) {
    const auto pressed = [&](WORD mask) { return (p.wButtons & mask) != 0; };
    const auto stick = [](SHORT v) { return v < 0 ? v / 32768.F : v / 32767.F; };
    PadValues out{{{
        {2, pressed(XINPUT_GAMEPAD_A)}, {1, pressed(XINPUT_GAMEPAD_B)},
        {4, pressed(XINPUT_GAMEPAD_X)}, {3, pressed(XINPUT_GAMEPAD_Y)},
        {5, pressed(XINPUT_GAMEPAD_LEFT_SHOULDER)}, {6, pressed(XINPUT_GAMEPAD_RIGHT_SHOULDER)},
        {7, pressed(XINPUT_GAMEPAD_BACK)}, {8, pressed(XINPUT_GAMEPAD_START)},
        {9, pressed(XINPUT_GAMEPAD_LEFT_THUMB)}, {10, pressed(XINPUT_GAMEPAD_RIGHT_THUMB)}
    }}, {{
        {1, float(pressed(XINPUT_GAMEPAD_DPAD_RIGHT)) - float(pressed(XINPUT_GAMEPAD_DPAD_LEFT))},
        {2, float(pressed(XINPUT_GAMEPAD_DPAD_UP)) - float(pressed(XINPUT_GAMEPAD_DPAD_DOWN))},
        {3, stick(p.sThumbLX)}, {4, stick(p.sThumbLY)},
        {5, stick(p.sThumbRX)}, {6, stick(p.sThumbRY)},
        {7, p.bLeftTrigger / 255.F}, {8, p.bRightTrigger / 255.F}
    }}};
    return out;
}
} // namespace monarch
