SCENARIOS = {
    "happy_hour": {
        "title": "Happy Hour - First Networking Event",
        "description": "Practice introducing yourself and making small talk at a work happy hour with new colleagues",
        "turns": [
            {
                "turn_index": 1,
                "video_url": "https://celia-audio-test-bucket.s3.us-east-2.amazonaws.com/videos/happy_hour_3.mp4",
                "transcript": "Hey, nice to meet you! Where are you from? Tell me a little about yourself?"
            },
            # {
            #     "turn_index": 2,
            #     "video_url": "https://celia-audio-test-bucket.s3.us-east-2.amazonaws.com/videos/happy_hour_6.mp4",
            #     "transcript": "I'm from Iowa! I grew up in the capital, Des Moines, but it's pretty small for a capital so it feels like a small town. How's it been settling in here? You doing anything fun this weekend?"
            # },
            # {
            #     "turn_index": 3,
            #     "video_url": "https://celia-audio-test-bucket.s3.us-east-2.amazonaws.com/videos/happy_hour_10.mp4",
            #     "transcript": "That's so cool! Hey, I've had a few of these drinks, so I gotta run to the bathroom, but it was great to meet you!"
            # }
        ]
    }
}


def get_turn_context(scenario_id: str, turn_index: int) -> dict:
    """
    Look up the scenario and turn information.
    Returns a dict with: scenario_title, scenario_description, and turn_transcript
    Returns None if scenario_id or turn_index not found.
    """
    if scenario_id not in SCENARIOS:
        return None
    
    scenario = SCENARIOS[scenario_id]
    
    # Find the turn with matching turn_index
    for turn in scenario["turns"]:
        if turn["turn_index"] == turn_index:
            return {
                "scenario_title": scenario["title"],
                "scenario_description": scenario["description"],
                "turn_transcript": turn["transcript"]
            }
    
    return None


def get_video_url(scenario_id: str, turn_index: int) -> str:
    """Returns the video URL for a given scenario and turn, or None if not found."""
    if scenario_id not in SCENARIOS:
        return None
    
    scenario = SCENARIOS[scenario_id]
    
    # Find the turn with matching turn_index
    for turn in scenario["turns"]:
        if turn["turn_index"] == turn_index:
            return turn["video_url"]
    
    return None
