"""유틸리티 함수들"""

from typing import Any, Dict


def format_response(data: Any, message: str = "Success") -> Dict[str, Any]:
    """표준 응답 형식"""
    return {
        "message": message,
        "data": data
    }


def paginate_query(query, page: int = 1, page_size: int = 10):
    """쿼리 페이지네이션"""
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size)

