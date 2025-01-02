# src/python/problem_cutter.py
import fitz
import os
import shutil
import threading
from PIL import Image
from typing import List, Tuple, Callable, Optional
from dataclasses import dataclass
import numpy as np

@dataclass
class ProblemCutterConfig:
    """ProblemCutter 설정"""
    resolution: int = 2  # 해상도 배율
    margin: int = 8     # 여백

class ProblemCutterError(Exception):
    """ProblemCutter 관련 예외"""
    pass

def parse_rects(rect_list: List, resolution: int) -> List[List]:
    """사각형 정보 파싱"""
    res = []
    for r in rect_list:
        res.append([
            int(r.x1 * resolution),
            int((r.y0 + r.y1) * resolution / 2),
            r.x0 == -1
        ])
    return sorted(res, key=lambda x: x[1])

def find_refs(pages: List, ids: List[str], resolution: int) -> Tuple[List[int], List[List]]:
    """참조점 찾기"""
    prob_ref = -1
    choice_ref = -1
    prob_num = 1
    choice_refs = [[]] * len(pages)
    
    # 문제와 선지의 참조점 찾기
    for page in pages:
        prob_res = page.search_for(ids[2])
        choice_res = page.search_for(ids[3])
        if len(prob_res):
            for r in prob_res:
                if prob_ref == -1 or r.x1 < prob_ref:
                    prob_ref = r.x1
        if len(choice_res):
            for r in choice_res:
                if choice_ref == -1 or r.x1 < choice_ref:
                    choice_ref = r.x1
    
    # 각 페이지별 선지 위치 찾기
    for i in range(len(pages)):
        choice_res = pages[i].search_for(f'{prob_num}.')
        j = 0
        while j < len(choice_res):
            if choice_res[j].x0 > prob_ref:
                del choice_res[j]
            else:
                choice_res[j].x0 = -1
                j += 1
        if len(choice_res):
            prob_num += 1
        for r in map(lambda x: pages[i].search_for(x), ids[3:5]):
            choice_res += r
        j = 0
        while j < len(choice_res):
            if choice_res[j].x0 > choice_ref:
                del choice_res[j]
            else:
                j += 1
        if len(choice_res):
            choice_refs[i] = parse_rects(choice_res, resolution)
            
    pos_refs = list(map(lambda x: int(x * resolution),
                       [pages[0].search_for(ids[0])[0].y1,
                        pages[0].search_for(ids[1])[0].y0]))
    
    return pos_refs, choice_refs

def crop_images(pages: List,
               pos_refs: List[int],
               choice_refs: List[List],
               resolution: int,
               margin: int) -> Tuple[List[Image.Image], List[bool]]:
    """이미지 자르기 (numpy 최적화 버전)"""
    images = []
    dets = []
    skip = resolution
    left = 0
    
    for i in range(0, len(pages)):
        pixmap = pages[i].get_pixmap(matrix=fitz.Matrix(resolution, resolution))
        try:
            # numpy 배열로 한 번만 변환
            img_array = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
                pixmap.height, pixmap.width, 3)
        finally:
            pixmap = None
            
        top = pos_refs[0]
        bot = pos_refs[0]
        min_length = img_array.shape[1] * 0.7
        is_first = True
        
        # 흰색 픽셀 마스크 생성 (255, 255, 255)
        white_mask = (img_array == 255).all(axis=2)
        
        for y in range(pos_refs[0], pos_refs[1], skip):
            # 현재 행의 비흰색 픽셀 수를 계산
            row = white_mask[y, ::skip]
            non_white_pixels = np.count_nonzero(~row)
            line_detected = (non_white_pixels * skip) > min_length
            is_white = non_white_pixels == 0
            
            if line_detected or y >= pos_refs[1] - skip:
                if is_first or top >= bot:
                    is_first = True
                    continue
                    
                is_merge = True
                for ref in choice_refs[i]:
                    if top < ref[1] and ref[1] < bot:
                        left = ref[0]
                        dets.append(ref[2])
                        is_merge = False
                        break
                        
                if is_merge:
                    if len(dets) and dets[-1]:
                        # numpy 배열을 PIL Image로 변환하여 자르기
                        box = (left, top - margin, img_array.shape[1], bot + margin)
                        cropped = Image.fromarray(img_array[
                            max(0, top - margin):min(img_array.shape[0], bot + margin),
                            left:img_array.shape[1]
                        ])
                        
                        merged = Image.new("RGB",
                                       (images[-1].width,
                                        images[-1].height + cropped.height))
                        merged.paste(images[-1], (0, 0))
                        merged.paste(cropped, (0, images[-1].height))
                        images[-1] = merged
                else:
                    box = (left, top - margin, img_array.shape[1], bot + margin)
                    cropped = Image.fromarray(img_array[
                        max(0, top - margin):min(img_array.shape[0], bot + margin),
                        left:img_array.shape[1]
                    ])
                    images.append(cropped)
                is_first = True
            else:
                if not is_white:
                    if is_first:
                        top = y
                        is_first = False
                    bot = y
                    
    return images, dets

def save_images(images: List[Image.Image],
               dets: List[bool],
               output_dir: str,
               name_pre: str) -> None:
    """이미지 저장"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    j = 0
    k = 0
    for i in range(len(images)):
        if dets[i]:
            j += 1
            k = 0
            name = name_pre + '{0:02d}{1}.png'.format(j, 9)
        else:
            name = name_pre + '{0:02d}{1}.png'.format(j, k)
            k += 1
        file = os.path.join(output_dir, name)
        images[i].save(file)

class ProblemCutter:
    def __init__(self, config: Optional[ProblemCutterConfig] = None):
        """ProblemCutter 초기화"""
        self.config = config or ProblemCutterConfig()
        self.running_threads = []
        self.running_threads_lock = threading.Lock()

    def process_pdf(self,
                   src_path: str,
                   output_dir: str,
                   name: str,
                   completion_callback: Callable = None) -> None:
        """PDF 처리
        
        Args:
            src_path: PDF 파일 경로
            output_dir: 출력 디렉토리
            name: 출력 파일 이름 prefix
            completion_callback: 완료 시 호출될 콜백 함수
        """
        try:
            ids = ["Version", "Page", "1.", "(O)", "(X)"]
            doc = fitz.open(src_path)
            margin = self.config.margin * self.config.resolution
            pages = [doc.load_page(i) for i in range(len(doc))]
            
            # 참조점 찾기
            pos_refs, choice_refs = find_refs(pages, ids, self.config.resolution)
            
            # 이미지 자르기
            images, dets = crop_images(pages,
                                     pos_refs,
                                     choice_refs,
                                     self.config.resolution,
                                     margin)
            
            # 이미지 저장
            save_images(images, dets, output_dir, name)
            
        except Exception as e:
            raise ProblemCutterError(f"Failed to process PDF: {str(e)}")
            
        finally:
            if completion_callback:
                completion_callback(threading.current_thread())

    def process_pdf_async(self,
                     src_path: str,
                     output_dir: str,
                     name: str,
                     completion_callback: Callable = None) -> None:
        """PDF 비동기 처리"""
        def wrapped_callback(thread):
            # 작업 완료 시 스레드 정리
            with self.running_threads_lock:
                if thread in self.running_threads:
                    self.running_threads.remove(thread)
            # 원본 콜백 실행
            if completion_callback:
                completion_callback(thread)

        # 스레드 생성 및 시작
        with self.running_threads_lock:
            thread = threading.Thread(
                target=self.process_pdf,
                args=(src_path, output_dir, name, wrapped_callback)
            )
            self.running_threads.append(thread)
            thread.start()

def process_pdf_file(src_path: str,
                    output_dir: str,
                    name: str,
                    config: dict = None) -> None:
    """Node.js에서 호출할 메인 함수
    
    Args:
        src_path: PDF 파일 경로
        output_dir: 출력 디렉토리
        name: 출력 파일 이름 prefix
        config: 설정 딕셔너리 (선택사항)
    """
    try:
        user_config = None
        if settings:
            config = ProblemCutterConfig(
                resolution=settings.get('resolution', 2),
                margin=settings.get('margin', 8)
            )
            
        cutter = ProblemCutter(user_config)
        cutter.process_pdf(src_path, output_dir, name)
        
    except Exception as e:
        raise ProblemCutterError(f"PDF processing failed: {str(e)}")

if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) < 4:
        print("Usage: problem_cutter.exe [pdf_path] [output_dir] [name] [settings]")
        sys.exit(1)
    
    try:
        # 인자 처리
        pdf_path = sys.argv[1]
        output_dir = sys.argv[2]
        name = sys.argv[3]
        settings = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None
        
        # 설정 적용
        config = None
        if settings:
            config = ProblemCutterConfig(
                resolution=settings.get('resolution', 2),
                margin=settings.get('margin', 8)
            )
            
        # 실행
        process_pdf_file(pdf_path, output_dir, name, config)
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)