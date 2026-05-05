def late_to_slab(late_str):
    """
    Go Solar Late Mark Policy:
    Office time  : 9:30 AM
    Grace period : 15 mins (up to 9:45 = no late mark)

    LateBy is minutes AFTER scheduled login (9:30 AM)

    0–15  mins → No deduction (grace period)
    16–30 mins → 20%  (9:45–10:00)
    31–60 mins → 30%  (10:00–10:30)
    >60   mins → 50%  (after 10:30)
    """
    try:
        s = str(late_str).strip()
        if not s or s in ('nan', '00:00', '0:00', ''):
            return 0.0

        parts      = s.split(':')
        total_mins = int(parts[0]) * 60 + int(parts[1])

        if   total_mins <= 15: return 0.0   # grace period
        elif total_mins <= 30: return 0.2   # 9:45–10:00
        elif total_mins <= 60: return 0.3   # 10:00–10:30
        else:                  return 0.5   # after 10:30

    except:
        return 0.0
