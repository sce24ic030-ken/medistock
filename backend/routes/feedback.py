from flask import Blueprint, request, jsonify, session
from models import db
from models.feedback import Feedback
from models.activity import Activity

feedback_bp = Blueprint('feedback', __name__)

def log_activity(user_id, action, details=None):
    try:
        activity = Activity(user_id=user_id, action=action, details=details)
        db.session.add(activity)
        db.session.commit()
    except:
        db.session.rollback()

@feedback_bp.route('/', methods=['POST'])
def submit_feedback():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        rating = int(data.get('rating', 0))
        comment = data.get('comment')
        user_id = session.get('user_id')
        
        if not all([name, email, rating, comment]):
            return jsonify({'error': 'All fields are required'}), 400
        
        if rating < 1 or rating > 5:
            return jsonify({'error': 'Rating must be between 1 and 5'}), 400
        
        feedback = Feedback(user_id=user_id, name=name, email=email, rating=rating, comment=comment)
        db.session.add(feedback)
        db.session.commit()
        
        if user_id:
            log_activity(user_id, 'Feedback Submitted', f'Rating: {rating}/5')
        
        return jsonify({'message': 'Thank you for your feedback!'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@feedback_bp.route('/', methods=['GET'])
def get_feedback():
    try:
        feedbacks = Feedback.query.order_by(Feedback.created_at.desc()).all()
        return jsonify({'feedback': [f.to_dict() for f in feedbacks]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
